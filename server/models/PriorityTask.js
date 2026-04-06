const mongoose = require('mongoose');

const priorityTaskSchema = new mongoose.Schema({
  issueId: { type: String, required: true, unique: true }, // "owner/repo#number"
  repo: { type: String, required: true },
  number: { type: Number, required: true },
  title: String,
  body: String,
  labels: [String],
  createdAt: Date,
  
  // AI Analyzed Tracking
  score: { type: Number, required: true, default: 0 }, // 0 - 100
  severity: { type: String, enum: ['Sev-1', 'Sev-2', 'Sev-3'], required: true },
  sentimentTag: { type: String, default: "Neutral" }, // e.g. "High Anger", "Frustration", "Neutral"
  trend: { type: String, enum: ['Escalating', 'Stable', 'Declining'], default: 'Stable' },
  reason: String,
  
  status: { type: String, enum: ['active', 'assigned', 'resolved'], default: 'active' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PriorityTask', priorityTaskSchema);
