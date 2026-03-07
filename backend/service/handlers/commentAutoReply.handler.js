const {
    AutoReplySetting
} = require('../../model/Instaautomation');

// ==================== COMMENT AUTO-REPLY HANDLER ====================
// Handles: enable/disable/configure comment auto-reply settings

module.exports = {
    name: 'commentAutoReply',
    intents: ['enable_comment_autoreply', 'disable_comment_autoreply', 'configure_comment_autoreply'],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            if (intent === 'enable_comment_autoreply') {
                const mode = params.mode || 'ai_smart';
                const delay = params.delay || 15;
                const message = params.message || '';

                await AutoReplySetting.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        enabled: true,
                        delaySeconds: Math.min(Math.max(delay, 5), 300),
                        message,
                        replyMode: mode
                    },
                    { upsert: true, new: true }
                );

                const modeLabels = {
                    'reply_only': 'Reply Only',
                    'reply_and_hide': 'Smart Hide (auto-removes spam)',
                    'ai_smart': 'AI Smart (persona-based)'
                };

                return {
                    success: true,
                    message: `Comment auto-reply enabled! Mode: ${modeLabels[mode] || mode}, Delay: ${delay}s`,
                    data: { enabled: true, mode, delay }
                };
            }

            if (intent === 'disable_comment_autoreply') {
                await AutoReplySetting.findOneAndUpdate(
                    { userId },
                    { enabled: false },
                    { upsert: true }
                );

                return {
                    success: true,
                    message: 'Comment auto-reply has been turned off.',
                    data: { enabled: false }
                };
            }

            if (intent === 'configure_comment_autoreply') {
                const update = {};
                if (params.mode) update.replyMode = params.mode;
                if (params.delay) {
                    const parsedDelay = parseInt(params.delay);
                    if (!isNaN(parsedDelay)) {
                        update.delaySeconds = Math.min(Math.max(parsedDelay, 5), 300);
                    }
                }
                if (params.message !== undefined) update.message = params.message;
                if (params.enabled !== undefined) update.enabled = params.enabled;

                const setting = await AutoReplySetting.findOneAndUpdate(
                    { userId },
                    { userId, ...update },
                    { upsert: true, new: true }
                );

                return {
                    success: true,
                    message: `Comment auto-reply updated! ${Object.keys(update).map(k => `${k}: ${update[k]}`).join(', ')}`,
                    data: setting.toObject()
                };
            }

            return { success: false, message: 'Unknown comment auto-reply action.' };
        } catch (error) {
            console.error('[Handler:commentAutoReply] Error:', error.message);
            return { success: false, message: `Failed to update comment auto-reply: ${error.message}` };
        }
    }
};
