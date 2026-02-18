const mongoose = require('mongoose');

const creatorPersonaSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    analysisTimestamp: { type: Date, default: Date.now },
    communicationStyle: { type: String, default: "friendly and professional" }, // Description of style
    toneKeywords: { type: [String], default: [] }, // e.g., ["excited", "grateful", "concise"]
    commonPhrases: { type: [String], default: [] }, // Examples from past posts/replies
    emojiUsage: { type: String }, // e.g., "Frequent use of ✨ and 🔥"
    sentenceLength: { type: String }, // e.g., "Short and punchy" or "Long and detailed"
    sampleReplies: [{
        context: String,
        reply: String
    }] // Few-shot examples
});

module.exports = mongoose.model('CreatorPersona', creatorPersonaSchema);
