const mongoose = require('mongoose');

const userTokenSchema = new mongoose.Schema({
    userId: { type: String, default: 'singleton' }, // single-user MVP
    githubAccessToken: { type: String, default: null },
    githubLogin: { type: String, default: null },
    githubAvatarUrl: { type: String, default: null },
    connectedAt: { type: Date, default: null },
    repos: { type: [String], default: [] }
});

module.exports = mongoose.model('UserToken', userTokenSchema);
