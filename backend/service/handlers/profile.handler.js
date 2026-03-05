const axios = require('axios');
const { Token } = require('../../model/Instaautomation');
const CreatorPersona = require('../../model/CreatorPersona');

// ==================== PROFILE HANDLER ====================
// Handles: fetch profile, show stats, analyze persona

const GRAPH_BASE = `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`;

module.exports = {
    name: 'profile',
    intents: ['get_profile', 'analyze_persona'],

    async execute(intent, params, context) {
        const { userId, token } = context;

        try {
            if (intent === 'get_profile') {
                const accessToken = token || (await Token.findOne({ userId }))?.accessToken;
                if (!accessToken) {
                    return { success: false, message: 'No access token found. Please reconnect your Instagram.' };
                }

                const response = await axios.get(`${GRAPH_BASE}/me`, {
                    params: {
                        fields: 'id,username,account_type,media_count,followers_count,follows_count,biography,profile_picture_url',
                        access_token: accessToken
                    }
                });

                const p = response.data;
                const profileCard = [
                    `**@${p.username}** (${p.account_type})`,
                    `👥 ${p.followers_count?.toLocaleString() || 'N/A'} followers · ${p.follows_count?.toLocaleString() || 'N/A'} following`,
                    `📸 ${p.media_count?.toLocaleString() || 'N/A'} posts`,
                    p.biography ? `📝 "${p.biography}"` : ''
                ].filter(Boolean).join('\n');

                return {
                    success: true,
                    message: `Here's your Instagram profile:\n\n${profileCard}`,
                    data: p
                };
            }

            if (intent === 'analyze_persona') {
                const aiService = require('../aiService');
                const accessToken = token || (await Token.findOne({ userId }))?.accessToken;
                if (!accessToken) {
                    return { success: false, message: 'No access token found. Please reconnect your Instagram.' };
                }

                // Check if already analyzed
                const existing = await CreatorPersona.findOne({ userId });
                if (existing && existing.analysisTimestamp) {
                    const daysSince = Math.floor((Date.now() - existing.analysisTimestamp.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSince < 7) {
                        return {
                            success: true,
                            message: `Your persona was analyzed ${daysSince} day(s) ago. Style: ${existing.communicationStyle}. I'm already mimicking your vibe! ✨`,
                            data: { alreadyAnalyzed: true, style: existing.communicationStyle }
                        };
                    }
                }

                // Trigger analysis (non-blocking)
                aiService.analyzeProfile(userId, accessToken)
                    .then(r => console.log('[Handler:profile] Persona analysis done:', r.success))
                    .catch(e => console.error('[Handler:profile] Persona analysis error:', e.message));

                return {
                    success: true,
                    message: 'Started analyzing your Instagram style! I\'m studying your posts and replies to learn your vibe. This takes about 30 seconds.',
                    data: { analyzing: true }
                };
            }

            return { success: false, message: 'Unknown profile action.' };
        } catch (error) {
            console.error('[Handler:profile] Error:', error.response?.data || error.message);
            return { success: false, message: `Profile fetch failed: ${error.response?.data?.error?.message || error.message}` };
        }
    }
};
