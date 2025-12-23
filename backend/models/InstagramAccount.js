const mongoose = require('mongoose');

const instagramAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    instagramUserId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    accessToken: {
        type: String,
        required: true
    },
    tokenExpiry: {
        type: Date,
        required: true
    },
    accountType: {
        type: String,
        enum: ['BUSINESS', 'CREATOR', 'PERSONAL'],
        default: 'BUSINESS'
    },
    profilePictureUrl: String,
    followersCount: Number,
    followsCount: Number,
    mediaCount: Number,
    biography: String,
    website: String,
    isConnected: {
        type: Boolean,
        default: true
    },
    lastSynced: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InstagramAccount', instagramAccountSchema);
