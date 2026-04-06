const mongoose = require('mongoose');

const duplicateClusterSchema = new mongoose.Schema({
  clusterId: { type: String, required: true, unique: true }, // e.g. uuid or hash
  repo: { type: String, required: true },
  name: { type: String, required: true }, // AI-generated cluster name
  reason: String,
  canonicalIssue: { type: String, required: true }, // issueId
  duplicates: [
    {
      issueId: String,
      similarityScore: Number,
      status: { type: String, enum: ['active', 'merged', 'ignored'], default: 'active' }
    }
  ],
  confidence: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DuplicateCluster', duplicateClusterSchema);
