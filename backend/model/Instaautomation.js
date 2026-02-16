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
    message: { type: String, required: true }
});

// ==================== AUTO-REPLY SETTINGS (DMs) ====================
const dmAutoReplySettingSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    delaySeconds: { type: Number, default: 10, min: 5, max: 300 },
    message: { type: String, required: true }
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
    unreadCount: { type: Number, default: 0 }
});

// ==================== WEBHOOK EVENT LOG (Debug) ====================
const webhookEventSchema = new mongoose.Schema({
    receivedAt: { type: Date, default: Date.now },
    object: { type: String },
    entryCount: { type: Number },
    raw: { type: String }
});

webhookEventSchema.index({ receivedAt: -1 });

// ==================== EXPORT MODELS ====================
const Token = mongoose.model('Token', tokenSchema);
const AutoReplySetting = mongoose.model('AutoReplySetting', autoReplySettingSchema);
const DmAutoReplySetting = mongoose.model('DmAutoReplySetting', dmAutoReplySettingSchema);
const AutoReplyLog = mongoose.model('AutoReplyLog', autoReplyLogSchema);
const DmAutoReplyLog = mongoose.model('DmAutoReplyLog', dmAutoReplyLogSchema);
const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = {
    Token,
    AutoReplySetting,
    DmAutoReplySetting,
    AutoReplyLog,
    DmAutoReplyLog,
    Message,
    Conversation,
    WebhookEvent
};
