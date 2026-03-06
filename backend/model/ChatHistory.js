const mongoose = require('mongoose');

// ==================== CHAT MESSAGE SCHEMA ====================
const chatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },

    // What actions were taken (for assistant messages)
    actions: [{
        intent: { type: String },
        success: { type: Boolean },
        message: { type: String },
        data: { type: mongoose.Schema.Types.Mixed }
    }],

    // Toast notifications generated
    toasts: [{
        type: { type: String, enum: ['success', 'error', 'warning', 'info'] },
        title: { type: String },
        message: { type: String }
    }],

    timestamp: { type: Date, default: Date.now }
});

// ==================== CHAT HISTORY SCHEMA ====================
const chatHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    messages: [chatMessageSchema],
    priorityTag: {
        type: String,
        enum: ['Collaboration', 'Support', 'Fan Mail', 'Spam', 'Other', 'Untriaged'],
        default: 'Untriaged'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

chatHistorySchema.index({ userId: 1, updatedAt: -1 });

// Auto-update timestamp
chatHistorySchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
