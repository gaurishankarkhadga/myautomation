const {
    DmAutoReplySetting
} = require('../../model/Instaautomation');

// ==================== DM AUTO-REPLY HANDLER ====================
// Handles: enable/disable/configure DM auto-reply settings

module.exports = {
    name: 'dmAutoReply',
    intents: ['enable_dm_autoreply', 'disable_dm_autoreply', 'configure_dm_autoreply'],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            if (intent === 'enable_dm_autoreply') {
                const mode = params.mode || 'ai_with_assets';
                const delay = params.delay || 10;
                const message = params.message || '';

                await DmAutoReplySetting.findOneAndUpdate(
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
                    'static': 'Static (fixed message)',
                    'ai_smart': 'AI Smart (persona-based)',
                    'ai_with_assets': 'AI + Assets (shares products & links)'
                };

                return {
                    success: true,
                    message: `DM auto-reply enabled! Mode: ${modeLabels[mode] || mode}, Delay: ${delay}s`,
                    data: { enabled: true, mode, delay }
                };
            }

            if (intent === 'disable_dm_autoreply') {
                await DmAutoReplySetting.findOneAndUpdate(
                    { userId },
                    { enabled: false },
                    { upsert: true }
                );

                return {
                    success: true,
                    message: 'DM auto-reply has been turned off.',
                    data: { enabled: false }
                };
            }

            if (intent === 'configure_dm_autoreply') {
                const update = {};
                if (params.mode) update.replyMode = params.mode;
                if (params.delay) update.delaySeconds = Math.min(Math.max(params.delay, 5), 300);
                if (params.message !== undefined) update.message = params.message;
                if (params.enabled !== undefined) update.enabled = params.enabled;

                const setting = await DmAutoReplySetting.findOneAndUpdate(
                    { userId },
                    { userId, ...update },
                    { upsert: true, new: true }
                );

                return {
                    success: true,
                    message: `DM auto-reply updated! ${Object.keys(update).map(k => `${k}: ${update[k]}`).join(', ')}`,
                    data: setting.toObject()
                };
            }

            return { success: false, message: 'Unknown DM auto-reply action.' };
        } catch (error) {
            console.error('[Handler:dmAutoReply] Error:', error.message);
            return { success: false, message: `Failed to update DM auto-reply: ${error.message}` };
        }
    }
};
