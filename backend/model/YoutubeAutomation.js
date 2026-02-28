const mongoose = require('mongoose');

// ==================== YOUTUBE TOKEN SCHEMA ====================
const ytTokenSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    channelTitle: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// ==================== YOUTUBE AUTO-REPLY SETTINGS (Comments) ====================
const ytAutoReplySettingSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    delaySeconds: { type: Number, default: 10, min: 5, max: 300 },
    message: { type: String, default: '' },
    replyMode: {
        type: String,
        enum: ['reply_only', 'reply_and_hide', 'ai_smart'],
        default: 'reply_only'
    },
    pollIntervalSeconds: { type: Number, default: 60, min: 30, max: 300 }
});

// ==================== YOUTUBE AUTO-REPLY LOG ====================
const ytAutoReplyLogSchema = new mongoose.Schema({
    commentId: { type: String, required: true },
    videoId: { type: String },
    commentText: { type: String },
    commenterName: { type: String },
    replyText: { type: String },
    replyId: { type: String },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    action: { type: String, enum: ['replied', 'hidden', 'skipped'], default: 'replied' },
    error: { type: String, default: null },
    scheduledAt: { type: Date, default: Date.now },
    repliedAt: { type: Date, default: null }
});

ytAutoReplyLogSchema.index({ scheduledAt: -1 });

// ==================== PROCESSED COMMENTS TRACKER ====================
const ytProcessedCommentSchema = new mongoose.Schema({
    commentId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    processedAt: { type: Date, default: Date.now }
});

ytProcessedCommentSchema.index({ processedAt: -1 });

// ==================== EXPORT MODELS ====================
const YTToken = mongoose.model('YTToken', ytTokenSchema);
const YTAutoReplySetting = mongoose.model('YTAutoReplySetting', ytAutoReplySettingSchema);
const YTAutoReplyLog = mongoose.model('YTAutoReplyLog', ytAutoReplyLogSchema);
const YTProcessedComment = mongoose.model('YTProcessedComment', ytProcessedCommentSchema);

module.exports = {
    YTToken,
    YTAutoReplySetting,
    YTAutoReplyLog,
    YTProcessedComment
};
