const CreatorPreference = require('../../model/CreatorPreference');

// ==================== PREFERENCES HANDLER ====================
// Handles: set/get/reset creator automation preferences via chat
// Examples: "only automate recent video", "reply to top 100 comments", "auto-reply for 24 hours"

module.exports = {
    name: 'preferences',
    intents: [
        'set_content_target',      // "only automate my recent video"
        'set_time_limit',          // "only for 24 hours"
        'set_comment_limit',       // "only reply to 100 comments"
        'get_preferences',         // "show my preferences"
        'reset_preferences'        // "reset all preferences"
    ],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            // ==================== SET CONTENT TARGET ====================
            if (intent === 'set_content_target') {
                const target = params.target || 'all';  // all, recent, first, previous, specific
                const maxPosts = params.maxPosts || 0;
                const postTitle = params.postTitle || params.title || '';

                const update = {
                    'contentTarget.type': target,
                    'contentTarget.maxPosts': maxPosts
                };

                if (target === 'specific' && postTitle) {
                    update['contentTarget.specificPostTitle'] = postTitle;
                }
                if (params.postId) {
                    update['contentTarget.specificPostId'] = params.postId;
                }

                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    { userId, ...update },
                    { upsert: true }
                );

                const targetLabels = {
                    'all': '📋 All posts/videos',
                    'recent': '🆕 Most recent post only',
                    'first': '1️⃣ First post only',
                    'previous': '⏮️ Previous (second most recent) post',
                    'specific': `🎯 Specific: "${postTitle || 'unnamed'}"`
                };

                const label = targetLabels[target] || target;
                const extraInfo = maxPosts > 0 ? ` (max ${maxPosts} posts)` : '';

                return {
                    success: true,
                    message: `Content targeting set to: ${label}${extraInfo}. Auto-reply will only apply to this content.`,
                    data: { target, maxPosts, postTitle }
                };
            }

            // ==================== SET TIME LIMIT ====================
            if (intent === 'set_time_limit') {
                const hours = params.hours || params.duration || 24;
                const startedAt = new Date();
                const expiresAt = new Date(startedAt.getTime() + hours * 60 * 60 * 1000);

                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        'timeLimit.enabled': true,
                        'timeLimit.hours': hours,
                        'timeLimit.startedAt': startedAt,
                        'timeLimit.expiresAt': expiresAt
                    },
                    { upsert: true }
                );

                const expireTime = expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const expireDate = expiresAt.toLocaleDateString();

                return {
                    success: true,
                    message: `⏰ Time limit set! Auto-reply will be active for **${hours} hours** and auto-stop at ${expireTime} on ${expireDate}.`,
                    data: { hours, startedAt, expiresAt }
                };
            }

            // ==================== SET COMMENT LIMIT ====================
            if (intent === 'set_comment_limit') {
                const maxReplies = params.maxReplies || params.count || params.limit || 100;
                const scope = params.scope || 'total'; // 'per_post' or 'total'

                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        'commentLimit.enabled': true,
                        'commentLimit.maxReplies': maxReplies,
                        'commentLimit.repliedCount': 0,
                        'commentLimit.scope': scope
                    },
                    { upsert: true }
                );

                const scopeLabel = scope === 'per_post' ? 'per post' : 'total';

                return {
                    success: true,
                    message: `🔢 Comment limit set! I'll reply to a maximum of **${maxReplies}** comments (${scopeLabel}). After that, I'll stop auto-replying.`,
                    data: { maxReplies, scope }
                };
            }

            // ==================== GET PREFERENCES ====================
            if (intent === 'get_preferences') {
                const prefs = await CreatorPreference.findOne({ userId }).lean();

                if (!prefs) {
                    return {
                        success: true,
                        message: '📋 No custom preferences set. I\'m running with defaults:\n• Content: All posts\n• Time limit: None\n• Comment limit: Unlimited\n\nTell me things like "only automate recent video" or "reply to top 50 comments" to customize!',
                        data: null
                    };
                }

                const targetLabels = {
                    'all': 'All posts/videos',
                    'recent': 'Most recent only',
                    'first': 'First post only',
                    'previous': 'Previous post',
                    'specific': `Specific: "${prefs.contentTarget?.specificPostTitle || 'unnamed'}"`
                };

                const lines = [
                    '📋 **Your Automation Preferences:**\n',
                    `🎯 **Content:** ${targetLabels[prefs.contentTarget?.type] || 'All'}${prefs.contentTarget?.maxPosts ? ` (max ${prefs.contentTarget.maxPosts} posts)` : ''}`,
                ];

                if (prefs.timeLimit?.enabled) {
                    const remaining = prefs.timeLimit.expiresAt
                        ? Math.max(0, Math.round((new Date(prefs.timeLimit.expiresAt) - Date.now()) / (1000 * 60 * 60) * 10) / 10)
                        : 0;
                    lines.push(`⏰ **Time Limit:** ${prefs.timeLimit.hours}h (${remaining > 0 ? `${remaining}h remaining` : '⚠️ Expired'})`);
                } else {
                    lines.push('⏰ **Time Limit:** No limit');
                }

                if (prefs.commentLimit?.enabled) {
                    lines.push(`🔢 **Comment Limit:** ${prefs.commentLimit.repliedCount}/${prefs.commentLimit.maxReplies} (${prefs.commentLimit.scope})`);
                } else {
                    lines.push('🔢 **Comment Limit:** Unlimited');
                }

                if (prefs.platforms) {
                    const active = [];
                    if (prefs.platforms.instagram) active.push('📸 Instagram');
                    if (prefs.platforms.youtube) active.push('🎬 YouTube');
                    lines.push(`🌐 **Platforms:** ${active.length > 0 ? active.join(', ') : 'None'}`);
                }

                return {
                    success: true,
                    message: lines.join('\n'),
                    data: prefs
                };
            }

            // ==================== RESET PREFERENCES ====================
            if (intent === 'reset_preferences') {
                await CreatorPreference.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        contentTarget: { type: 'all', specificPostId: '', specificPostTitle: '', maxPosts: 0 },
                        timeLimit: { enabled: false, hours: 0, startedAt: null, expiresAt: null },
                        commentLimit: { enabled: false, maxReplies: 0, repliedCount: 0, scope: 'total' },
                        platforms: { instagram: true, youtube: false }
                    },
                    { upsert: true }
                );

                return {
                    success: true,
                    message: '🔄 All preferences reset to defaults! Auto-reply will apply to all posts with no time or comment limits.',
                    data: null
                };
            }

            return { success: false, message: 'Unknown preference action.' };
        } catch (error) {
            console.error('[Handler:preferences] Error:', error.message);
            return { success: false, message: `Preference update failed: ${error.message}` };
        }
    }
};
