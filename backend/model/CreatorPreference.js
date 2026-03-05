const mongoose = require('mongoose');

// ==================== CREATOR PREFERENCE SCHEMA ====================
// Stores creator-specific automation preferences set via chat
// Examples: "only automate recent video", "24 hours only", "top 100 comments"

const creatorPreferenceSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },

    // ==================== CONTENT TARGETING ====================
    contentTarget: {
        type: { type: String, enum: ['all', 'recent', 'specific', 'first', 'previous'], default: 'all' },
        // 'all' = all posts/videos, 'recent' = most recent only, 'specific' = named post,
        // 'first' = first ever post, 'previous' = second most recent
        specificPostId: { type: String, default: '' },     // For targeting a specific post
        specificPostTitle: { type: String, default: '' },   // Human-readable label
        maxPosts: { type: Number, default: 0 }              // 0 = unlimited, or limit to N posts
    },

    // ==================== TIME LIMITS ====================
    timeLimit: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0 },                // Auto-disable after N hours (0 = no limit)
        startedAt: { type: Date, default: null },            // When the timer started
        expiresAt: { type: Date, default: null }             // Auto-calculated expiry
    },

    // ==================== COMMENT LIMITS ====================
    commentLimit: {
        enabled: { type: Boolean, default: false },
        maxReplies: { type: Number, default: 0 },            // Max comments to reply to (0 = unlimited)
        repliedCount: { type: Number, default: 0 },          // Running count
        scope: { type: String, enum: ['per_post', 'total'], default: 'total' }
    },

    // ==================== PLATFORM PREFERENCES ====================
    platforms: {
        instagram: { type: Boolean, default: true },
        youtube: { type: Boolean, default: false }
    },

    updatedAt: { type: Date, default: Date.now }
});

creatorPreferenceSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('CreatorPreference', creatorPreferenceSchema);
