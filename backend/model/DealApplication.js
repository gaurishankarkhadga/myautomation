const mongoose = require('mongoose');

// ==================== DEAL APPLICATION SCHEMA ====================
const dealApplicationSchema = new mongoose.Schema({
    // References
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: String, required: true, index: true },   // Instagram userId

    // AI Match Score
    matchScore: { type: Number, min: 0, max: 100, default: 0 },
    matchReasons: [String],     // ["Niche alignment: fitness", "Engagement above average"]

    // Application Content
    pitch: {
        subject: { type: String, default: '' },
        body: { type: String, default: '' },
        generatedAt: { type: Date }
    },

    // Auto Media Kit (snapshot at application time)
    mediaKit: {
        username: { type: String },
        followers: { type: Number },
        engagementRate: { type: Number },
        avgLikes: { type: Number },
        avgComments: { type: Number },
        niche: { type: String },
        followerTier: { type: String },
        bio: { type: String },
        topHashtags: [String],
        contentMix: {
            images: { type: Number, default: 0 },
            videos: { type: Number, default: 0 },
            carousels: { type: Number, default: 0 },
            reels: { type: Number, default: 0 }
        }
    },

    // Showcase Posts (creator selects their best work)
    showcasePosts: [{
        postId: String,
        caption: String,
        likes: Number,
        comments: Number,
        mediaType: String,
        permalink: String
    }],

    // Personal Note
    personalNote: { type: String, default: '' },

    // Application Status Pipeline
    applicationStatus: {
        type: String,
        enum: ['pending', 'reviewed', 'accepted', 'rejected', 'withdrawn'],
        default: 'pending'
    },

    // Timestamps
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    statusUpdatedAt: { type: Date }

}, { timestamps: true });

// Prevent duplicate applications
dealApplicationSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });
dealApplicationSchema.index({ applicationStatus: 1, creatorId: 1 });

module.exports = mongoose.model('DealApplication', dealApplicationSchema);
