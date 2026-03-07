const mongoose = require('mongoose');

// ==================== TOKEN SCHEMA ====================
const tokenSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    expiresIn: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

// ==================== AUTO-REPLY SETTINGS (Comments) ====================
const autoReplySettingSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    delaySeconds: { type: Number, default: 10, min: 5, max: 300 },
    message: { type: String, default: '' },
    replyMode: {
        type: String,
        enum: ['reply_only', 'reply_and_hide', 'ai_smart'],
        default: 'reply_only'
    },
    viralTagEnabled: { type: Boolean, default: false }
});

// ==================== AUTO-REPLY SETTINGS (DMs) ====================
const dmAutoReplySettingSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    delaySeconds: { type: Number, default: 10, min: 5, max: 300 },
    message: { type: String, default: '' },
    replyMode: {
        type: String,
        enum: ['static', 'ai_smart', 'ai_with_assets'],
        default: 'static'
    },
    aiPersonality: { type: String, default: '' }, // Custom personality override
    storyMentionEnabled: { type: Boolean, default: false },
    storyMentionMessage: { type: String, default: 'Thank you so much for the mention! ❤️' },
    inboxTriageEnabled: { type: Boolean, default: false }
});

// ==================== AUTO-REPLY LOG (Comments) ====================
const autoReplyLogSchema = new mongoose.Schema({
    commentId: { type: String, required: true },
    commentText: { type: String },
    commenterUsername: { type: String },
    mediaId: { type: String },
    replyText: { type: String },
    replyId: { type: String },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    action: { type: String, enum: ['replied', 'hidden', 'skipped'], default: 'replied' },
    error: { type: String, default: null },
    scheduledAt: { type: Date, default: Date.now },
    repliedAt: { type: Date, default: null }
});

autoReplyLogSchema.index({ scheduledAt: -1 });

// ==================== AUTO-REPLY LOG (DMs) ====================
const dmAutoReplyLogSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    senderIGSID: { type: String },
    messageText: { type: String },
    replyText: { type: String },
    replyType: {
        type: String,
        enum: ['text', 'text_with_link', 'image', 'product_recommendation'],
        default: 'text'
    },
    assetsShared: [{
        assetId: String,
        assetTitle: String,
        assetType: String
    }],
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: { type: String, default: null },
    scheduledAt: { type: Date, default: Date.now },
    repliedAt: { type: Date, default: null }
});

dmAutoReplyLogSchema.index({ scheduledAt: -1 });

// ==================== MESSAGE SCHEMA ====================
const messageSchema = new mongoose.Schema({
    messageId: { type: String },
    senderId: { type: String, required: true, index: true },
    recipientId: { type: String },
    text: { type: String },
    attachments: { type: Array, default: [] },
    timestamp: { type: Number },
    received: { type: Date, default: Date.now }
});

// ==================== CONVERSATION SCHEMA ====================
const conversationSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
    lastMessage: { type: Object },
    lastMessageTime: { type: Number },
    unreadCount: { type: Number, default: 0 },
    priorityTag: { type: String, enum: ['Collaboration', 'Support', 'Fan Mail', 'Spam', 'Other', 'Untriaged'], default: 'Untriaged' }
});

// ==================== WEBHOOK EVENT LOG (Debug & Queue) ====================
const webhookEventSchema = new mongoose.Schema({
    receivedAt: { type: Date, default: Date.now },
    object: { type: String },
    entryCount: { type: Number },
    raw: { type: String },
    // Custom Fields for queued tasks
    userId: { type: String },
    eventType: { type: String },
    processed: { type: Boolean, default: false },
    payload: { type: Object },
    scheduledAt: { type: Date }
});

webhookEventSchema.index({ receivedAt: -1 });
webhookEventSchema.index({ eventType: 1, processed: 1, scheduledAt: 1 });

// ==================== GLOBAL API USAGE SCHEMA ====================
const apiUsageSchema = new mongoose.Schema({
    dateString: { type: String, required: true, unique: true }, // e.g. "2026-03-07"
    geminiCalls: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

// ==================== EXPORT MODELS ====================
const Token = mongoose.model('Token', tokenSchema);
const AutoReplySetting = mongoose.model('AutoReplySetting', autoReplySettingSchema);
const DmAutoReplySetting = mongoose.model('DmAutoReplySetting', dmAutoReplySettingSchema);
const AutoReplyLog = mongoose.model('AutoReplyLog', autoReplyLogSchema);
const DmAutoReplyLog = mongoose.model('DmAutoReplyLog', dmAutoReplyLogSchema);
const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);

module.exports = {
    Token,
    AutoReplySetting,
    DmAutoReplySetting,
    AutoReplyLog,
    DmAutoReplyLog,
    Message,
    Conversation,
    WebhookEvent,
    ApiUsage
};
