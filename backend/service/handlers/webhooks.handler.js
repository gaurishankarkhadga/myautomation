const axios = require('axios');
const { Token } = require('../../model/Instaautomation');

// ==================== WEBHOOKS HANDLER ====================
// Handles: subscribe to Instagram webhooks

const GRAPH_BASE = `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`;

module.exports = {
    name: 'webhooks',
    intents: ['subscribe_webhooks'],

    async execute(intent, params, context) {
        const { userId, token } = context;

        try {
            if (intent === 'subscribe_webhooks') {
                const accessToken = token;
                if (!accessToken) {
                    // Try to get from DB
                    const tokenDoc = await Token.findOne({ userId });
                    if (!tokenDoc) {
                        return { success: false, message: 'No access token found. Please reconnect your Instagram account.' };
                    }
                }

                const actualToken = accessToken || (await Token.findOne({ userId }))?.accessToken;

                // Subscribe to comments and messages
                const response = await axios.post(
                    `${GRAPH_BASE}/me/subscribed_apps`,
                    null,
                    {
                        params: {
                            subscribed_fields: 'comments,messages',
                            access_token: actualToken
                        }
                    }
                );

                if (response.data.success) {
                    return {
                        success: true,
                        message: 'Webhooks subscribed! I\'ll now receive comment and DM events from Instagram. Auto-reply is ready to work.',
                        data: { subscribed: true }
                    };
                } else {
                    return { success: false, message: 'Webhook subscription response was not successful. Try again.' };
                }
            }

            return { success: false, message: 'Unknown webhook action.' };
        } catch (error) {
            console.error('[Handler:webhooks] Error:', error.response?.data || error.message);
            const errorMsg = error.response?.data?.error?.message || error.message;
            return { success: false, message: `Webhook subscription failed: ${errorMsg}` };
        }
    }
};
