const mongoose = require('mongoose');

const reportCacheSchema = new mongoose.Schema({
  repo: { type: String, required: true, unique: true }, // e.g. "owner/repo"
  
  productivityLiftHrs: { type: Number, default: 0 },
  deduplicationAccuracy: { type: Number, default: 0 },
  macroSentiment: { type: String, default: "Neutral" }, // e.g. "High", "Critical", "Neutral"
  
  keywordHotspots: [{
    keyword: String,
    trend: String, // "+24%" or "-10%"
    type: { type: String, enum: ['positive', 'negative', 'neutral'], default: 'neutral' }
  }],
  
  activityLogs: [{
    eventType: String, // "Deduplication", "Anomaly Detected", etc.
    target: String,
    confidence: Number,
    outcome: String,
    timestamp: Date
  }],
  
  generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ReportCache', reportCacheSchema);
