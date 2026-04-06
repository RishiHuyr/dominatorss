const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    triageThreshold: {
        type: Number,
        default: 85
    },
    autoCategorization: {
        type: Boolean,
        default: true
    },
    sentimentAnalysis: {
        type: Boolean,
        default: true
    },
    connectedRepos: {
        type: [String],
        default: []
    },
    githubConnected: {
        type: Boolean,
        default: false
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
