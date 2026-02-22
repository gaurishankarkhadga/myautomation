const mongoose = require('mongoose');

// ==================== CAMPAIGN SCHEMA (Brand Deal Posting) ====================
const campaignSchema = new mongoose.Schema({
    // Brand Info
    brandName: { type: String, required: true, index: true },
    brandLogo: { type: String, default: '' },
    brandWebsite: { type: String, default: '' },
    brandDescription: { type: String, default: '' },

    // Campaign Details
    title: { type: String, required: true },
    description: { type: String, required: true },
    deliverables: { type: String, default: '' },       // "2 Reels + 3 Stories"
    requirements: { type: String, default: '' },        // "Must have 5K+ followers"
    guidelines: { type: String, default: '' },          // Content guidelines

    // Budget & Compensation
    budgetMin: { type: Number, default: 0 },
    budgetMax: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    compensationType: {
        type: String,
        enum: ['paid', 'product', 'affiliate', 'hybrid'],
        default: 'paid'
    },

    // Targeting
    targetNiche: { type: String, required: true },
    targetSubNiches: [String],
    minFollowers: { type: Number, default: 1000 },
    maxFollowers: { type: Number, default: 1000000 },
    preferredPlatforms: { type: [String], default: ['instagram'] },

    // Metadata
    category: { type: String, default: '' },            // fashion, tech, beauty, etc.
    tags: [String],
    applicationDeadline: { type: Date },
    campaignStartDate: { type: Date },
    campaignEndDate: { type: Date },

    // Status
    status: {
        type: String,
        enum: ['open', 'closed', 'filled', 'draft'],
        default: 'open'
    },

    // Stats
    applicationsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },

    // Admin / Brand reference (for future brand dashboard)
    createdBy: { type: String, default: 'admin' },
    contactEmail: { type: String, default: '' },

}, { timestamps: true });

campaignSchema.index({ status: 1, targetNiche: 1 });
campaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Campaign', campaignSchema);
