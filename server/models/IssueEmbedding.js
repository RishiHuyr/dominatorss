const mongoose = require('mongoose');

const issueEmbeddingSchema = new mongoose.Schema({
  issueId: { type: String, required: true, unique: true }, // e.g. "microsoft/vscode#8492"
  repo: { type: String, required: true },
  number: { type: Number, required: true },
  title: String,
  body: String,
  labels: [String],
  createdAt: Date,
  vector: { type: [Number], required: true }, // Array of floats from OpenAI
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IssueEmbedding', issueEmbeddingSchema);
