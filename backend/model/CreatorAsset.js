const mongoose = require('mongoose');

// ==================== CREATOR ASSET SCHEMA ====================
// Stores products, links, courses, images that the creator wants AI to share in DMs
// Modular design — easy to add new asset types (merch, ebooks, etc.)

const creatorAssetSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },

    // Asset type — extensible enum
    type: {
        type: String,
        required: true,
        enum: ['product', 'link', 'course', 'image', 'service', 'ebook', 'merch'],
        index: true
    },

    // Core fields
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 500 },
    url: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    price: { type: String, default: '' },

    // AI matching — tags help Gemini find the right asset for user intent
    tags: { type: [String], default: [] },

    // Controls
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }, // Sent on random/generic DMs
    priority: { type: Number, default: 0 }, // Higher = recommended first

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index for fast queries
creatorAssetSchema.index({ userId: 1, type: 1, isActive: 1 });
creatorAssetSchema.index({ userId: 1, isDefault: 1 });

// Auto-update timestamp
creatorAssetSchema.pre('save', function () {
    this.updatedAt = new Date();
});

creatorAssetSchema.pre('findOneAndUpdate', function () {
    this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('CreatorAsset', creatorAssetSchema);
