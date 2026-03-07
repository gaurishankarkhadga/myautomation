const {
    DmAutoReplySetting
} = require('../../model/Instaautomation');

// ==================== DM AUTO-REPLY HANDLER ====================
// Handles: enable/disable/configure DM auto-reply settings

module.exports = {
    name: 'dmAutoReply',
    intents: ['enable_dm_autoreply', 'disable_dm_autoreply', 'configure_dm_autoreply', 'set_dm_fallback'],

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
                if (params.delay) {
                    const parsedDelay = parseInt(params.delay);
                    if (!isNaN(parsedDelay)) {
                        update.delaySeconds = Math.min(Math.max(parsedDelay, 5), 300);
                    }
                }
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

            if (intent === 'set_dm_fallback') {
                const fallbackMsg = params.message || params.fallback || params.text;

                if (!fallbackMsg || fallbackMsg.trim().length === 0) {
                    return {
                        success: false,
                        message: 'What should I use as your fallback DM message? Just tell me the message you want sent when AI can\'t generate a reply.'
                    };
                }

                await DmAutoReplySetting.findOneAndUpdate(
                    { userId },
                    { userId, message: fallbackMsg.trim() },
                    { upsert: true }
                );

                return {
                    success: true,
                    message: `✅ Fallback message set! If AI ever fails, I'll send: "${fallbackMsg.trim()}"`,
                    data: { fallbackMessage: fallbackMsg.trim() }
                };
            }

            return { success: false, message: 'Unknown DM auto-reply action.' };
        } catch (error) {
            console.error('[Handler:dmAutoReply] Error:', error.message);
            return { success: false, message: `Failed to update DM auto-reply: ${error.message}` };
        }
    }
};
