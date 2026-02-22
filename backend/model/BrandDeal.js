const mongoose = require('mongoose');

// ==================== BRAND DEAL SCHEMA ====================
const brandDealSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    analysisTimestamp: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['analyzing', 'completed', 'failed'],
        default: 'analyzing'
    },

    // Creator profile snapshot at time of analysis
    creatorProfile: {
        username: { type: String },
        followerCount: { type: Number },
        mediaCount: { type: Number },
        engagementRate: { type: Number },
        avgLikes: { type: Number },
        avgComments: { type: Number },
        niche: { type: String },
        subNiches: [String],
        contentTypes: {
            images: { type: Number, default: 0 },
            videos: { type: Number, default: 0 },
            carousels: { type: Number, default: 0 },
            reels: { type: Number, default: 0 }
        },
        topHashtags: [String],
        followerTier: { type: String },
        bio: { type: String }
    },

    // Discovered brand deals — each has its own pipeline status
    brandDeals: [{
        brandName: { type: String, required: true },
        category: { type: String },
        matchScore: { type: Number, min: 0, max: 100 },
        collaborationType: { type: String },
        estimatedBudget: { type: String },
        description: { type: String },
        whyItMatches: { type: String },
        programName: { type: String },
        requirements: { type: String },
        contactEmail: { type: String, default: '' },
        programUrl: { type: String, default: '' },

        // Per-deal pipeline tracking (creator-side CRM)
        dealStatus: {
            type: String,
            enum: ['discovered', 'saved', 'pitched', 'waiting', 'won', 'lost', 'skipped'],
            default: 'discovered'
        },
        statusUpdatedAt: { type: Date },
        savedAt: { type: Date },
        pitchedAt: { type: Date },

        // Stored pitch (AI-generated, editable)
        pitch: {
            subject: { type: String, default: '' },
            body: { type: String, default: '' },
            generatedAt: { type: Date }
        },

        // Creator's personal notes
        notes: { type: String, default: '' },
        priority: {
            type: String,
            enum: ['high', 'medium', 'low', ''],
            default: ''
        }
    }],

    // Auto-generated media kit
    mediaKit: {
        followers: { type: Number },
        engagementRate: { type: Number },
        avgLikes: { type: Number },
        avgComments: { type: Number },
        niche: { type: String },
        followerTier: { type: String },
        topHashtags: [String],
        bio: { type: String },
        contentMix: {
            images: { type: Number, default: 0 },
            videos: { type: Number, default: 0 },
            carousels: { type: Number, default: 0 },
            reels: { type: Number, default: 0 }
        },
        generatedAt: { type: Date }
    },

    error: { type: String, default: null }
});

brandDealSchema.index({ userId: 1, analysisTimestamp: -1 });

module.exports = mongoose.model('BrandDeal', brandDealSchema);
