const mongoose = require('mongoose');

const creatorPersonaSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    analysisTimestamp: { type: Date, default: Date.now },
    dataSource: { type: String, enum: ['captions_only', 'captions_and_replies'], default: 'captions_only' },
    replyPairsAnalyzed: { type: Number, default: 0 },

    // Style analysis (from captions + replies)
    communicationStyle: { type: String, default: 'friendly and professional' },
    toneKeywords: { type: [String], default: [] },
    commonPhrases: { type: [String], default: [] },
    emojiUsage: { type: String },
    emojiFrequency: { type: String, enum: ['heavy', 'moderate', 'rare', 'none'], default: 'moderate' },
    sentenceLength: { type: String },

    // Reply-specific analysis (from actual comment replies)
    replyStyle: { type: String },
    averageReplyLength: { type: Number },
    lowercasePreference: { type: Boolean, default: false },
    slangPatterns: { type: [String], default: [] },

    // Actual reply examples collected from Instagram
    replyExamples: [{
        commentText: String,
        creatorReply: String
    }],

    // AI-generated sample replies based on analysis
    sampleReplies: [{
        context: String,
        reply: String
    }],

    // Google-researched creator info for deep persona mimicry
    onlineResearch: {
        niche: { type: String, default: '' },
        brandVoice: { type: String, default: '' },
        publicLinks: { type: [String], default: [] },
        knownPlatforms: { type: [String], default: [] },
        contentThemes: { type: [String], default: [] },
        audienceType: { type: String, default: '' },
        rawResearch: { type: String, default: '' },
        researchedAt: { type: Date }
    }
});

module.exports = mongoose.model('CreatorPersona', creatorPersonaSchema);
