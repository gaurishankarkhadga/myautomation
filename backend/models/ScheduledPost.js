const mongoose = require('mongoose');

const scheduledPostSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    instagramAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InstagramAccount',
        required: true
    },
    caption: {
        type: String,
        required: true
    },
    mediaUrl: {
        type: String,
        required: true
    },
    mediaType: {
        type: String,
        enum: ['IMAGE', 'VIDEO', 'CAROUSEL'],
        default: 'IMAGE'
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED'],
        default: 'PENDING'
    },
    publishedAt: Date,
    instagramPostId: String,
    errorMessage: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ScheduledPost', scheduledPostSchema);
