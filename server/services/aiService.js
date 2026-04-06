const { OpenAI } = require('openai');
const Settings = require('../models/Settings');

class AiService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeIssue(issueData) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in .env file.');
    }

    const systemPrompt = `You are an elite expert software engineer.
You are given a GitHub issue report, including the description and potentially some comments.
Your task is to analyze it completely and return a STRICT JSON object representing your neural analysis.
The JSON must adhere exactly to this format (do not include markdown wrapping or other text):
{
  "severity": "Low" | "Medium" | "High" | "Critical",
  "category": "Frontend" | "Backend" | "Security" | "Memory Leak" | "Database" | "Architecture" | "Other",
  "confidence": <integer between 0 and 100>,
  "analysis": "<succinct paragraph summarizing your analysis>",
  "root_cause": "<detailed root cause hypothesis>",
  "fix_suggestion": "<bullet points or paragraph on how to fix>",
  "code_patch": "<code>" (If no code is applicable, return empty string)
}`;

    const userContent = `Issue Title: ${issueData.title}
Issue Body: ${issueData.body}
Labels: ${issueData.labels.join(', ')}

Comments:
${issueData.commentsData.slice(0, 5).map(c => `[${c.author}]: ${c.body}`).join('\n')}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // or gpt-3.5-turbo if 4o unavailable depending on billing
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const resultText = response.choices[0].message.content;
      return JSON.parse(resultText);
    } catch (error) {
      console.error('OpenAI Error:', error.message);
      throw new Error('Failed to analyze issue with AI.');
    }
  }

  // --- DUPLICATE DETECTION LOGIC --- //

  async generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('⚠️ aiService: generateEmbedding received empty or invalid text. Skipping.');
      return null;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ aiService: OPENAI_API_KEY is missing from environment.');
      return null;
    }

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const response = await this.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text.substring(0, 8000), // Simple character limit safety
          encoding_format: "float",
        });
        return response.data[0].embedding;
      } catch (e) {
        attempt++;
        console.error(`❌ Embedding attempt ${attempt} failed:`, e.message);
        
        // Log detailed error for quota/rate limit debugging
        if (e.status) {
          console.error(`   HTTP Status: ${e.status}`);
          if (e.error) console.error(`   API Error:`, JSON.stringify(e.error, null, 2));
        }

        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`   Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error('❌ All embedding retries exhausted.');
          return null;
        }
      }
    }
  }


  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async generateClusterMetadata(issuesList) {
    const concatenatedTitles = issuesList.map(i => `- #${i.number}: ${i.title}`).join('\n');
    const systemPrompt = `You are a triage AI. Review these duplicate issue titles and generate metadata for the cluster.
Return STRICT JSON:
{
  "name": "Short summary of what these issues are about (max 8 words)",
  "reason": "One sentence explaining why they are duplicates."
}`;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: concatenatedTitles }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      return { name: "Duplicate Cluster", reason: "Found semantically similar language across issues." };
    }
  }

  // --- PRIORITY ENGINE LOGIC --- //

  async generatePriorityScore(issue) {
    let cfg;
    try {
        cfg = await Settings.findOne();
    } catch(e) {};
    
    if(!cfg) {
        cfg = { triageThreshold: 85, autoCategorization: true, sentimentAnalysis: true };
    }

    let dynamicSentimentRule = cfg.sentimentAnalysis ? "Analyze the tone and emotion (Neutral, Frustration, High Anger)." : "Skip sentiment analysis and strictly categorize logic.";
    let thresholdRule = `Scaling is strict: Use a base threshold of ${cfg.triageThreshold}% confidence to determine absolute Sev-1.`;
    
    const systemPrompt = `You are an AI Triage Commander scaling GitHub urgency.
Analyze the following issue payload. Detect urgency keywords (crash, timeout, security, immediate).
${dynamicSentimentRule}
${thresholdRule}

Return STRICT JSON:
{
  "score": <0-100 number>, // 100 is absolute max severity
  "severity": "<Sev-1 | Sev-2 | Sev-3>",
  "sentimentTag": "<Short 2-3 word sentiment, or 'N/A' if sentiment analysis disabled>",
  "trend": "<Escalating | Stable | Declining>", // Escalate if urgency implies immediate snowballing
  "reason": "One sentence explaining logic behind score."
}

Scoring guide based on your ${cfg.triageThreshold} threshold strictness:
Sev-1: Critical crash, outage, security. Score must be higher than ${cfg.triageThreshold}.
Sev-2: Major bug, blocking feature, rising frustration.
Sev-3: Minor UI, nice-to-have, questions.
`;

    const userPayload = `
Title: ${issue.title}
Labels: ${issue.labels ? issue.labels.join(', ') : 'None'}
Body: ${issue.body}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating priority score:', error.message);
      return {
        score: 30,
        severity: "Sev-3",
        sentimentTag: "Neutral",
        trend: "Stable",
        reason: "Fallback to Sev-3 due to AI processing error."
      };
    }
  }

  // --- MACRO INSIGHTS ENGINE --- //

  async generateGlobalInsights(aggData) {
    const systemPrompt = `You are a Global Repository Architecture Analyzer.
I am passing you aggregated data arrays mapping current issue metrics and sentiment.
Analyze the arrays to extract repository keyword trends and a unified sentiment standing.

Return STRICT JSON:
{
  "macroSentiment": "High" | "Neutral" | "Critical",
  "keywordHotspots": [
     {
       "keyword": "<Short 1-2 words like 'API V2'>",
       "trend": "<e.g. +42% or -12%>",
       "type": "positive" | "negative" | "neutral"
     }
  ] // Return exactly 4 hotspots
}
`;
    // We only pass the aggregated labels and reasons to extract trending keywords
    const payload = JSON.stringify({
      hotLabels: aggData.labels,
      recentReasons: aggData.reasons
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: payload }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch(e) {
      return {
        macroSentiment: "Neutral",
        keywordHotspots: [
          { keyword: "Connection Issue", trend: "+5%", type: "neutral" },
          { keyword: "UI Bug", trend: "-2%", type: "neutral" },
          { keyword: "Performance", trend: "+10%", type: "negative" },
          { keyword: "Refactor", trend: "+20%", type: "positive" }
        ]
      }
    }
  }
}

module.exports = new AiService();
