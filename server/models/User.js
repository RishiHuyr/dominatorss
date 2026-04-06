const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    avatar: { type: String },
    accessToken: { type: String },
    connectedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
