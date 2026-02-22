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
        followerTier: { type: String }, // nano, micro, mid, macro, mega
        bio: { type: String }
    },

    // Discovered brand deals
    brandDeals: [{
        brandName: { type: String, required: true },
        category: { type: String },
        matchScore: { type: Number, min: 0, max: 100 },
        collaborationType: { type: String }, // sponsored, affiliate, ambassador, gifting, etc.
        estimatedBudget: { type: String },
        applyUrl: { type: String },
        description: { type: String },
        whyItMatches: { type: String },
        programName: { type: String },
        requirements: { type: String }
    }],

    // AI-generated outreach templates (Phase 2)
    outreachTemplates: [{
        brandName: { type: String },
        subject: { type: String },
        body: { type: String },
        generatedAt: { type: Date, default: Date.now }
    }],

    error: { type: String, default: null }
});

brandDealSchema.index({ userId: 1, analysisTimestamp: -1 });

module.exports = mongoose.model('BrandDeal', brandDealSchema);
