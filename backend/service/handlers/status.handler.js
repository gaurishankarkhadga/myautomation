const {
    AutoReplySetting,
    DmAutoReplySetting,
    AutoReplyLog,
    DmAutoReplyLog
} = require('../../model/Instaautomation');
const CreatorAsset = require('../../model/CreatorAsset');
const CreatorPersona = require('../../model/CreatorPersona');
const BrandDeal = require('../../model/BrandDeal');

// ==================== STATUS HANDLER ====================
// Handles: show all current automation status, activity overview

module.exports = {
    name: 'status',
    intents: ['get_status', 'get_comments_log', 'get_dm_log'],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            // ==================== FULL STATUS ====================
            if (intent === 'get_status') {
                const [commentSettings, dmSettings, persona, assets, recentCommentLogs, recentDmLogs, brandDeal] = await Promise.all([
                    AutoReplySetting.findOne({ userId }).lean(),
                    DmAutoReplySetting.findOne({ userId }).lean(),
                    CreatorPersona.findOne({ userId }).lean(),
                    CreatorAsset.countDocuments({ userId, isActive: true }),
                    AutoReplyLog.countDocuments({}),
                    DmAutoReplyLog.countDocuments({}),
                    BrandDeal.findOne({ userId }).sort({ analysisTimestamp: -1 }).lean()
                ]);

                const modeLabels = {
                    'reply_only': 'Reply Only',
                    'reply_and_hide': 'Smart Hide',
                    'ai_smart': 'AI Smart',
                    'static': 'Static',
                    'ai_with_assets': 'AI + Assets'
                };

                const sections = [
                    '📊 **Your Automation Dashboard**\n',
                    `💬 **Comment Auto-Reply:** ${commentSettings?.enabled ? `✅ ON (${modeLabels[commentSettings.replyMode] || commentSettings.replyMode}, ${commentSettings.delaySeconds}s delay)` : '❌ OFF'}`,
                    `✉️ **DM Auto-Reply:** ${dmSettings?.enabled ? `✅ ON (${modeLabels[dmSettings.replyMode] || dmSettings.replyMode}, ${dmSettings.delaySeconds}s delay)` : '❌ OFF'}`,
                    `🤖 **AI Persona:** ${persona?.communicationStyle ? `✅ Analyzed (${persona.communicationStyle})` : '❌ Not analyzed yet'}`,
                    `📦 **Active Assets:** ${assets} items`,
                    `📋 **Comment Replies Sent:** ${recentCommentLogs}`,
                    `📩 **DM Replies Sent:** ${recentDmLogs}`,
                    `🤝 **Brand Deals:** ${brandDeal ? `${brandDeal.brandDeals?.length || 0} discovered` : 'Not searched yet'}`
                ];

                return {
                    success: true,
                    message: sections.join('\n'),
                    data: {
                        commentAutoReply: commentSettings || { enabled: false },
                        dmAutoReply: dmSettings || { enabled: false },
                        personaAnalyzed: !!persona?.communicationStyle,
                        activeAssets: assets,
                        totalCommentReplies: recentCommentLogs,
                        totalDmReplies: recentDmLogs
                    }
                };
            }

            // ==================== COMMENT LOG ====================
            if (intent === 'get_comments_log') {
                const limit = params.limit || 10;
                const logs = await AutoReplyLog.find({})
                    .sort({ scheduledAt: -1 })
                    .limit(limit)
                    .lean();

                if (logs.length === 0) {
                    return {
                        success: true,
                        message: 'No comment replies yet. Once auto-reply is enabled and someone comments, I\'ll handle it!',
                        data: { logs: [], count: 0 }
                    };
                }

                const logList = logs.map((l, i) => {
                    const statusIcon = l.status === 'sent' ? '✅' : l.status === 'failed' ? '❌' : '⏳';
                    return `${statusIcon} @${l.commenterUsername}: "${l.commentText?.substring(0, 50)}..." → "${l.replyText?.substring(0, 50)}..."`;
                }).join('\n');

                return {
                    success: true,
                    message: `📋 **Recent Comment Replies** (${logs.length}):\n\n${logList}`,
                    data: { logs, count: logs.length }
                };
            }

            // ==================== DM LOG ====================
            if (intent === 'get_dm_log') {
                const limit = params.limit || 10;
                const logs = await DmAutoReplyLog.find({})
                    .sort({ scheduledAt: -1 })
                    .limit(limit)
                    .lean();

                if (logs.length === 0) {
                    return {
                        success: true,
                        message: 'No DM replies yet. Once DM auto-reply is enabled and someone messages you, I\'ll handle it!',
                        data: { logs: [], count: 0 }
                    };
                }

                const logList = logs.map((l, i) => {
                    const statusIcon = l.status === 'sent' ? '✅' : l.status === 'failed' ? '❌' : '⏳';
                    return `${statusIcon} "${l.messageText?.substring(0, 40)}..." → "${l.replyText?.substring(0, 40)}..."`;
                }).join('\n');

                return {
                    success: true,
                    message: `📩 **Recent DM Replies** (${logs.length}):\n\n${logList}`,
                    data: { logs, count: logs.length }
                };
            }

            return { success: false, message: 'Unknown status action.' };
        } catch (error) {
            console.error('[Handler:status] Error:', error.message);
            return { success: false, message: `Failed to get status: ${error.message}` };
        }
    }
};
