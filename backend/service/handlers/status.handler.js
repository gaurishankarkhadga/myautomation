const {
    AutoReplySetting,
    DmAutoReplySetting,
    AutoReplyLog,
    DmAutoReplyLog
} = require('../../model/Instaautomation');
const CreatorAsset = require('../../model/CreatorAsset');
const CreatorPersona = require('../../model/CreatorPersona');
const CreatorPreference = require('../../model/CreatorPreference');
const BrandDeal = require('../../model/BrandDeal');
const axios = require('axios');

const GRAPH_BASE_URL = 'https://graph.instagram.com/v22.0';

// ==================== STATUS HANDLER ====================
// Handles: show automation status, active automation dashboard with video details, logs

module.exports = {
    name: 'status',
    intents: ['get_status', 'get_active_automations', 'get_comments_log', 'get_dm_log'],

    async execute(intent, params, context) {
        const { userId, token } = context;

        try {
            // ==================== FULL STATUS ====================
            if (intent === 'get_status') {
                const [commentSettings, dmSettings, persona, assets, prefs, recentCommentLogs, recentDmLogs, brandDeal] = await Promise.all([
                    AutoReplySetting.findOne({ userId }).lean(),
                    DmAutoReplySetting.findOne({ userId }).lean(),
                    CreatorPersona.findOne({ userId }).lean(),
                    CreatorAsset.countDocuments({ userId, isActive: true }),
                    CreatorPreference.findOne({ userId }).lean(),
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

                // Count active automations
                let activeCount = 0;
                if (commentSettings?.enabled) activeCount++;
                if (dmSettings?.enabled) activeCount++;
                if (commentSettings?.viralTagEnabled) activeCount++;
                if (dmSettings?.inboxTriageEnabled) activeCount++;
                if (dmSettings?.storyMentionEnabled) activeCount++;

                const sections = [
                    `📊 **Your Automation Dashboard** (${activeCount} active)\n`,
                    `💬 **Comment Auto-Reply:** ${commentSettings?.enabled ? `✅ ON (${modeLabels[commentSettings.replyMode] || commentSettings.replyMode}, ${commentSettings.delaySeconds}s delay)` : '❌ OFF'}`,
                    `✉️ **DM Auto-Reply:** ${dmSettings?.enabled ? `✅ ON (AI-Powered, ${dmSettings.delaySeconds}s delay)` : '❌ OFF'}`,
                    `🚀 **Viral Tag Auto-Reply:** ${commentSettings?.viralTagEnabled ? '✅ ON (AI scheduled for 24h later)' : '❌ OFF'}`,
                    `📥 **Inbox AI Triage:** ${dmSettings?.inboxTriageEnabled ? '✅ ON (Automatic categorization via Gemini)' : '❌ OFF'}`,
                    `📸 **Story Mentions:** ${dmSettings?.storyMentionEnabled ? '✅ ON (Auto-sending thank yous)' : '❌ OFF'}`,
                    `🤖 **AI Persona:** ${persona?.communicationStyle ? `✅ Analyzed (${persona.communicationStyle})` : '❌ Not analyzed yet'}`,
                    `📦 **Active Assets:** ${assets} items`,
                    `📋 **Comment Replies Sent:** ${recentCommentLogs}`,
                    `📩 **DM Replies Sent:** ${recentDmLogs}`,
                    `🤝 **Brand Deals:** ${brandDeal ? `${brandDeal.brandDeals?.length || 0} discovered` : 'Not searched yet'}`
                ];

                // Fetch conversation priority tags
                const conversations = await require('../../model/Instaautomation').Conversation.find({ senderId: { $ne: userId } }).lean();
                const priorityCounts = { 'Collaboration': 0, 'Support': 0, 'Fan Mail': 0, 'Spam': 0, 'Other': 0 };
                conversations.forEach(c => {
                    if (priorityCounts[c.priorityTag] !== undefined) priorityCounts[c.priorityTag]++;
                    else priorityCounts['Other']++;
                });

                sections.push('\n**📥 Inbox Triage Summary:**');
                sections.push(`🤝 Collab: ${priorityCounts['Collaboration']} | 🛠️ Support: ${priorityCounts['Support']} | ❤️ Fan: ${priorityCounts['Fan Mail']} | 🚫 Spam: ${priorityCounts['Spam']} | 🤷 Other: ${priorityCounts['Other']}`);

                // Add preferences info if set
                if (prefs) {
                    sections.push('\n**⚙️ Preferences:**');
                    if (prefs.contentTarget?.type !== 'all') {
                        const targetLabels = { 'recent': '🆕 Recent post', 'first': '1️⃣ First post', 'previous': '⏮️ Previous post', 'specific': '🎯 Specific post' };
                        sections.push(`🎯 Target: ${targetLabels[prefs.contentTarget.type] || prefs.contentTarget.type}`);
                    }
                    if (prefs.timeLimit?.enabled) {
                        const remaining = prefs.timeLimit.expiresAt
                            ? Math.max(0, Math.round((new Date(prefs.timeLimit.expiresAt) - Date.now()) / (1000 * 60)))
                            : 0;
                        sections.push(`⏰ Time: ${remaining > 60 ? `${Math.round(remaining / 60)}h remaining` : remaining > 0 ? `${remaining}m remaining` : '⚠️ Expired'}`);
                    }
                    if (prefs.commentLimit?.enabled) {
                        sections.push(`🔢 Limit: ${prefs.commentLimit.repliedCount}/${prefs.commentLimit.maxReplies} comments`);
                    }
                }

                return {
                    success: true,
                    message: sections.join('\n'),
                    data: {
                        activeCount,
                        commentAutoReply: commentSettings || { enabled: false },
                        dmAutoReply: dmSettings || { enabled: false },
                        preferences: prefs,
                        personaAnalyzed: !!persona?.communicationStyle,
                        activeAssets: assets,
                        totalCommentReplies: recentCommentLogs,
                        totalDmReplies: recentDmLogs,
                        inboxTriage: priorityCounts
                    }
                };
            }

            // ==================== ACTIVE AUTOMATIONS WITH VIDEO DETAILS ====================
            if (intent === 'get_active_automations') {
                const [commentSettings, dmSettings, prefs] = await Promise.all([
                    AutoReplySetting.findOne({ userId }).lean(),
                    DmAutoReplySetting.findOne({ userId }).lean(),
                    CreatorPreference.findOne({ userId }).lean()
                ]);

                const activeItems = [];
                let activeCount = 0;

                // Check comment auto-reply
                if (commentSettings?.enabled) {
                    activeCount++;
                    activeItems.push({
                        type: 'comment_reply',
                        label: '💬 Comment Auto-Reply',
                        mode: commentSettings.replyMode || 'ai_smart',
                        delay: commentSettings.delaySeconds
                    });
                }

                // Check DM auto-reply
                if (dmSettings?.enabled) {
                    activeCount++;
                    activeItems.push({
                        type: 'dm_reply',
                        label: '✉️ DM Auto-Reply',
                        mode: 'AI-Powered',
                        delay: dmSettings.delaySeconds
                    });
                }

                if (activeCount === 0) {
                    return {
                        success: true,
                        message: '💤 **No active automations right now.** Everything is off. Want me to turn something on?',
                        data: { activeCount: 0, automations: [], videos: [] }
                    };
                }

                // Build response
                const sections = [`🟢 **${activeCount} Active Automation${activeCount > 1 ? 's' : ''} Running**\n`];

                // List active automations
                const modeLabels = { 'reply_only': 'Reply Only', 'reply_and_hide': 'Smart Hide', 'ai_smart': 'AI Smart', 'ai_with_assets': 'AI + Assets' };
                for (const item of activeItems) {
                    sections.push(`${item.label} — ${modeLabels[item.mode] || item.mode} (${item.delay}s delay)`);
                }

                // Add preferences/targeting info
                if (prefs?.contentTarget?.type && prefs.contentTarget.type !== 'all') {
                    const targetLabels = { 'recent': '🆕 Most recent post only', 'first': '1️⃣ First post only', 'previous': '⏮️ Previous post', 'specific': `🎯 "${prefs.contentTarget.specificPostTitle || 'Specific post'}"` };
                    sections.push(`\n🎯 **Targeting:** ${targetLabels[prefs.contentTarget.type] || 'All posts'}`);
                } else {
                    sections.push('\n🎯 **Targeting:** All posts/videos');
                }

                // Time limit info
                if (prefs?.timeLimit?.enabled && prefs.timeLimit.expiresAt) {
                    const remaining = Math.max(0, Math.round((new Date(prefs.timeLimit.expiresAt) - Date.now()) / (1000 * 60)));
                    if (remaining > 0) {
                        const hours = Math.floor(remaining / 60);
                        const mins = remaining % 60;
                        sections.push(`⏰ **Auto-stop:** ${hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} remaining`);
                    } else {
                        sections.push('⏰ **Time limit expired** — automation may still be on. Say "stop everything" to turn off.');
                    }
                }

                // Comment limit info
                if (prefs?.commentLimit?.enabled) {
                    sections.push(`🔢 **Comment limit:** ${prefs.commentLimit.repliedCount}/${prefs.commentLimit.maxReplies} replies used`);
                }

                // Fetch actual videos/posts from Instagram if token available
                let videos = [];
                if (token) {
                    try {
                        const mediaRes = await axios.get(`${GRAPH_BASE_URL}/me/media`, {
                            params: {
                                fields: 'id,caption,media_type,thumbnail_url,timestamp,permalink,like_count,comments_count',
                                access_token: token,
                                limit: 5
                            }
                        });

                        if (mediaRes.data?.data?.length > 0) {
                            videos = mediaRes.data.data;
                            const targetType = prefs?.contentTarget?.type || 'all';

                            sections.push('\n📹 **Posts with automation:**');

                            if (targetType === 'recent') {
                                const v = videos[0];
                                sections.push(formatVideoLine(v, '🟢 Active'));
                            } else if (targetType === 'first') {
                                // First post = last in the list (oldest)
                                const v = videos[videos.length - 1];
                                sections.push(formatVideoLine(v, '🟢 Active'));
                            } else if (targetType === 'previous' && videos.length > 1) {
                                const v = videos[1];
                                sections.push(formatVideoLine(v, '🟢 Active'));
                            } else {
                                // All posts — show top 5
                                for (const v of videos.slice(0, 5)) {
                                    sections.push(formatVideoLine(v, '🟢'));
                                }
                                if (videos.length > 5) {
                                    sections.push(`   ...and more`);
                                }
                            }
                        }
                    } catch (mediaErr) {
                        console.log('[Status] Could not fetch media:', mediaErr.message);
                        sections.push('\n📹 *Could not fetch post details (token may need refresh)*');
                    }
                }

                return {
                    success: true,
                    message: sections.join('\n'),
                    data: { activeCount, automations: activeItems, videos, preferences: prefs }
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

// ==================== HELPER: Format video line for display ====================
function formatVideoLine(video, badge) {
    const caption = video.caption ? video.caption.substring(0, 40) : 'No caption';
    const type = video.media_type === 'VIDEO' ? '🎬' : video.media_type === 'CAROUSEL_ALBUM' ? '📸' : '🖼️';
    const likes = video.like_count || 0;
    const comments = video.comments_count || 0;
    const date = new Date(video.timestamp).toLocaleDateString();
    return `   ${badge} ${type} "${caption}..." (❤️${likes} 💬${comments}) — ${date}`;
}
