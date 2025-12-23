const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    instagramAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InstagramAccount',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    metrics: {
        impressions: Number,
        reach: Number,
        followerCount: Number,
        websiteClicks: Number,
        emailContacts: Number,
        profileViews: Number
    },
    topPosts: [{
        mediaId: String,
        mediaUrl: String,
        caption: String,
        likes: Number,
        comments: Number,
        engagement: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Analytics', analyticsSchema);
