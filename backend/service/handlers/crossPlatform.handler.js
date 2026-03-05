const { AutoReplySetting, DmAutoReplySetting } = require('../../model/Instaautomation');
const CreatorPreference = require('../../model/CreatorPreference');

// ==================== CROSS-PLATFORM HANDLER ====================
// Handles: enable/disable automation across ALL connected platforms at once
// Example: "automate comments for all social media", "enable everything"

module.exports = {
    name: 'crossPlatform',
    intents: [
        'enable_all_automation',     // "turn on everything" / "automate all platforms"
        'disable_all_automation',    // "turn off everything" / "stop all"
        'set_platform_preference'    // "enable only youtube" / "instagram only"
    ],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            // ==================== ENABLE ALL AUTOMATION ====================
            if (intent === 'enable_all_automation') {
                const mode = params.mode || 'ai_smart';
                const delay = params.delay || 10;
                const results = [];

                // Check which platforms are connected
                const instaConnected = !!context.token;
                // YouTube: check if yt settings or channel exist
                // For now, always try both and let failures be graceful

                // Enable Instagram comment auto-reply
                try {
                    await AutoReplySetting.findOneAndUpdate(
                        { userId },
                        { userId, enabled: true, delaySeconds: delay, replyMode: mode },
                        { upsert: true }
                    );
                    results.push({ platform: 'Instagram', feature: 'Comment Auto-Reply', success: true });
                } catch (e) {
                    results.push({ platform: 'Instagram', feature: 'Comment Auto-Reply', success: false, error: e.message });
                }

                // Enable Instagram DM auto-reply
                try {
                    await DmAutoReplySetting.findOneAndUpdate(
                        { userId },
                        { userId, enabled: true, delaySeconds: delay, replyMode: mode },
                        { upsert: true }
                    );
                    results.push({ platform: 'Instagram', feature: 'DM Auto-Reply', success: true });
                } catch (e) {
                    results.push({ platform: 'Instagram', feature: 'DM Auto-Reply', success: false, error: e.message });
                }

                // Update platform preferences
                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    { userId, 'platforms.instagram': true, 'platforms.youtube': true },
                    { upsert: true }
                );

                const successCount = results.filter(r => r.success).length;
                const summary = results.map(r => {
                    const icon = r.success ? '✅' : '❌';
                    return `${icon} ${r.platform} — ${r.feature}`;
                }).join('\n');

                return {
                    success: successCount > 0,
                    message: `🚀 **All automation enabled!** (${successCount}/${results.length} features)\n\n${summary}\n\nAll connected platforms are now set to ${mode === 'ai_smart' ? 'AI Smart' : mode} mode.`,
                    data: { results, mode }
                };
            }

            // ==================== DISABLE ALL AUTOMATION ====================
            if (intent === 'disable_all_automation') {
                const results = [];

                // Disable Instagram comment auto-reply
                try {
                    await AutoReplySetting.findOneAndUpdate(
                        { userId },
                        { enabled: false },
                        { upsert: false }
                    );
                    results.push({ platform: 'Instagram', feature: 'Comment Auto-Reply', success: true });
                } catch (e) {
                    results.push({ platform: 'Instagram', feature: 'Comment Auto-Reply', success: false });
                }

                // Disable Instagram DM auto-reply
                try {
                    await DmAutoReplySetting.findOneAndUpdate(
                        { userId },
                        { enabled: false },
                        { upsert: false }
                    );
                    results.push({ platform: 'Instagram', feature: 'DM Auto-Reply', success: true });
                } catch (e) {
                    results.push({ platform: 'Instagram', feature: 'DM Auto-Reply', success: false });
                }

                const summary = results.map(r => {
                    const icon = r.success ? '✅' : '❌';
                    return `${icon} ${r.platform} — ${r.feature} OFF`;
                }).join('\n');

                return {
                    success: true,
                    message: `⛔ **All automation stopped!**\n\n${summary}\n\nEverything is paused. Just say "turn on everything" to re-enable.`,
                    data: { results }
                };
            }

            // ==================== SET PLATFORM PREFERENCE ====================
            if (intent === 'set_platform_preference') {
                const instagram = params.instagram !== undefined ? params.instagram : true;
                const youtube = params.youtube !== undefined ? params.youtube : true;

                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    { userId, 'platforms.instagram': instagram, 'platforms.youtube': youtube },
                    { upsert: true }
                );

                const active = [];
                if (instagram) active.push('📸 Instagram');
                if (youtube) active.push('🎬 YouTube');

                return {
                    success: true,
                    message: `🌐 Platform preference updated! Automation will run on: ${active.length > 0 ? active.join(' + ') : '⚠️ No platforms selected'}`,
                    data: { instagram, youtube }
                };
            }

            return { success: false, message: 'Unknown cross-platform action.' };
        } catch (error) {
            console.error('[Handler:crossPlatform] Error:', error.message);
            return { success: false, message: `Cross-platform operation failed: ${error.message}` };
        }
    }
};
