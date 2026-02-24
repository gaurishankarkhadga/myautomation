const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Import all models
const {
    Token,
    AutoReplySetting,
    DmAutoReplySetting,
    AutoReplyLog,
    DmAutoReplyLog,
    Message,
    Conversation,
    WebhookEvent
} = require('../model/Instaautomation');
const CreatorPersona = require('../model/CreatorPersona');
const aiService = require('../service/aiService');
const brandDealService = require('../service/brandDealService');

// Instagram Graph API Configuration
const INSTAGRAM_CONFIG = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
    frontendUrl: process.env.FRONTEND_URL,
    oauthBaseUrl: 'https://api.instagram.com/oauth',
    graphBaseUrl: `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`,
    scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'instagram_business_content_publish']
};

// Webhook Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// In-memory pending reply trackers (timeouts can't be stored in DB)
const pendingReplies = new Map();
const pendingDMReplies = new Map();

// ==================== HELPER FUNCTIONS ====================

function verifyWebhookSignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || !req.rawBody) {
        console.log('[Webhook] No signature or raw body available - skipping verification');
        return true;
    }

    const expectedSignature = 'sha256=' +
        crypto.createHmac('sha256', INSTAGRAM_CONFIG.appSecret)
            .update(req.rawBody)
            .digest('hex');

    const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );

    if (!isValid) {
        console.error('[Webhook] SIGNATURE MISMATCH - possible spoofed request');
    }

    return isValid;
}


// this is only for th comment and message for access token and we can add as best replay
async function replyToComment(commentId, message, accessToken) {
    try {
        console.log('[AutoReply] Replying to comment:', commentId);

        const response = await axios.post(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/${commentId}/replies`,
            {
                message: message
            },
            {
                params: {
                    access_token: accessToken
                }
            }
        );

        console.log('[AutoReply] Reply sent successfully. Reply ID:', response.data.id);
        return { success: true, replyId: response.data.id };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[AutoReply] Failed to reply:', errorMsg);
        console.error('[AutoReply] Full error:', JSON.stringify(error.response?.data, null, 2));
        return { success: false, error: errorMsg };
    }
}

async function hideComment(commentId, accessToken) {
    try {
        console.log('[AutoReply] Hiding comment:', commentId);
        const response = await axios.post(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/${commentId}`,
            null,
            { params: { hide: true, access_token: accessToken } }
        );
        console.log('[AutoReply] Comment hidden successfully:', commentId);
        return { success: true };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[AutoReply] Failed to hide comment:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

async function deleteComment(commentId, accessToken) {
    try {
        console.log('[AutoReply] Deleting comment:', commentId);
        const response = await axios.delete(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/${commentId}`,
            { params: { access_token: accessToken } }
        );
        console.log('[AutoReply] Comment deleted successfully:', commentId);
        return { success: true };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[AutoReply] Failed to delete comment:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

async function sendDirectMessage(igUserId, recipientIGSID, message, accessToken) {
    try {
        console.log('[DM-AutoReply] Sending DM to IGSID:', recipientIGSID);

        const response = await axios.post(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/${igUserId}/messages`,
            {
                recipient: { id: recipientIGSID },
                message: { text: message }
            },
            {
                params: {
                    access_token: accessToken
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('[DM-AutoReply] DM sent successfully. Response:', JSON.stringify(response.data));
        return { success: true, data: response.data };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[DM-AutoReply] Failed to send DM:', errorMsg);
        console.error('[DM-AutoReply] Full error:', JSON.stringify(error.response?.data, null, 2));
        return { success: false, error: errorMsg };
    }
}

async function resolveUserIdMapping(igUserId) {
    // Direct match - check if settings exist for this ID in DB
    const hasCommentSettings = await AutoReplySetting.findOne({ userId: igUserId });
    const hasDmSettings = await DmAutoReplySetting.findOne({ userId: igUserId });

    if (hasCommentSettings || hasDmSettings) {
        return igUserId;
    }

    console.log(`[ID-Mapping] No settings for ${igUserId}, searching stored entries...`);

    // Find any stored user that has settings (different ID)
    let mappedId = null;

    const commentSetting = await AutoReplySetting.findOne({ userId: { $ne: igUserId } });
    if (commentSetting) {
        mappedId = commentSetting.userId;
    }

    if (!mappedId) {
        const dmSetting = await DmAutoReplySetting.findOne({ userId: { $ne: igUserId } });
        if (dmSetting) {
            mappedId = dmSetting.userId;
        }
    }

    if (!mappedId) {
        const tokenDoc = await Token.findOne({ userId: { $ne: igUserId } });
        if (tokenDoc) {
            mappedId = tokenDoc.userId;
        }
    }

    if (mappedId) {
        console.log(`[ID-Mapping] Syncing from stored ID ${mappedId} -> webhook ID ${igUserId}`);

        // Copy token to webhook ID
        const tokenData = await Token.findOne({ userId: mappedId });
        if (tokenData) {
            await Token.findOneAndUpdate(
                { userId: igUserId },
                { userId: igUserId, accessToken: tokenData.accessToken, expiresIn: tokenData.expiresIn, createdAt: tokenData.createdAt },
                { upsert: true }
            );
            console.log(`[ID-Mapping] Token synced to ${igUserId}`);
        }

        // Copy comment auto-reply settings to webhook ID
        const commentSettings = await AutoReplySetting.findOne({ userId: mappedId });
        if (commentSettings) {
            await AutoReplySetting.findOneAndUpdate(
                { userId: igUserId },
                { userId: igUserId, enabled: commentSettings.enabled, delaySeconds: commentSettings.delaySeconds, message: commentSettings.message, replyMode: commentSettings.replyMode || 'reply_only' },
                { upsert: true }
            );
            console.log(`[ID-Mapping] Comment auto-reply settings synced to ${igUserId}: enabled=${commentSettings.enabled}`);
        }

        // Copy DM auto-reply settings to webhook ID
        const dmSettings = await DmAutoReplySetting.findOne({ userId: mappedId });
        if (dmSettings) {
            await DmAutoReplySetting.findOneAndUpdate(
                { userId: igUserId },
                { userId: igUserId, enabled: dmSettings.enabled, delaySeconds: dmSettings.delaySeconds, message: dmSettings.message },
                { upsert: true }
            );
            console.log(`[ID-Mapping] DM auto-reply settings synced to ${igUserId}: enabled=${dmSettings.enabled}`);
        }

        // Copy CreatorPersona to webhook ID (for AI-powered replies)
        const personaData = await CreatorPersona.findOne({ userId: mappedId });
        if (personaData) {
            const personaObj = personaData.toObject();
            delete personaObj._id;
            await CreatorPersona.findOneAndUpdate(
                { userId: igUserId },
                { ...personaObj, userId: igUserId },
                { upsert: true }
            );
            console.log(`[ID-Mapping] CreatorPersona synced to ${igUserId}`);
        }

        return igUserId;
    }

    console.log(`[ID-Mapping] No stored data found to map for ${igUserId}`);
    return igUserId;
}

async function scheduleAutoReply(commentData, igUserId) {
    // Resolve ID mapping (webhook ID may differ from OAuth ID)
    igUserId = await resolveUserIdMapping(igUserId);

    const settings = await AutoReplySetting.findOne({ userId: igUserId });
    console.log(`[AutoReply] Settings found for ${igUserId}:`, settings ? 'Yes' : 'No');
    if (settings) console.log(`[AutoReply] Enabled: ${settings.enabled}, Mode: ${settings.replyMode || 'reply_only'}`);

    if (!settings || !settings.enabled) {
        console.log('[AutoReply] Auto-reply disabled for user:', igUserId);
        return;
    }

    // Don't reply to replies (only top-level comments)
    if (commentData.parentId) {
        console.log('[AutoReply] Skipping reply to sub-comment:', commentData.commentId);
        return;
    }

    // Don't reply if already pending/replied
    if (pendingReplies.has(commentData.commentId)) {
        console.log('[AutoReply] Already scheduled for comment:', commentData.commentId);
        return;
    }

    // Get access token for this user
    const tokenData = await Token.findOne({ userId: igUserId });
    if (!tokenData) {
        console.error('[AutoReply] No access token found for user:', igUserId);
        await AutoReplyLog.create({
            commentId: commentData.commentId,
            commentText: commentData.text,
            commenterUsername: commentData.username,
            mediaId: commentData.mediaId,
            replyText: '',
            status: 'failed',
            action: 'skipped',
            error: 'No access token found',
            scheduledAt: new Date(),
            repliedAt: null
        });
        return;
    }

    const replyMode = settings.replyMode || 'reply_only';

    // ==================== MODE: REPLY + SMART HIDE ====================
    if (replyMode === 'reply_and_hide') {
        console.log('[AutoReply] Mode: reply_and_hide — analyzing comment with AI...');

        try {
            const analysis = await aiService.analyzeComment(commentData.text, commentData.username);

            if (analysis.shouldHide) {
                // Try to DELETE toxic/spam comment first, fallback to hide
                console.log(`[AutoReply] Comment flagged as ${analysis.category}: "${analysis.reason}". Removing...`);

                let result = await deleteComment(commentData.commentId, tokenData.accessToken);

                if (!result.success) {
                    console.log('[AutoReply] Delete failed, trying hide instead...');
                    result = await hideComment(commentData.commentId, tokenData.accessToken);
                }

                await AutoReplyLog.create({
                    commentId: commentData.commentId,
                    commentText: commentData.text,
                    commenterUsername: commentData.username,
                    mediaId: commentData.mediaId,
                    replyText: `[REMOVED: ${analysis.category} — ${analysis.reason}]`,
                    status: result.success ? 'sent' : 'failed',
                    action: 'hidden',
                    error: result.error || null,
                    scheduledAt: new Date(),
                    repliedAt: new Date()
                });

                console.log(`[AutoReply] Comment ${result.success ? 'removed' : 'removal failed'}: ${commentData.commentId}`);
                return; // Don't reply to removed comments
            }

            // Comment is genuine — fall through to reply
            console.log(`[AutoReply] Comment is genuine (${analysis.category}). Proceeding to reply...`);
        } catch (err) {
            console.error('[AutoReply] Comment analysis failed, defaulting to reply:', err.message);
            // On error, just reply normally — safe fallback
        }
    }

    // ==================== DETERMINE REPLY MESSAGE & DELAY ====================
    let replyMessage = settings.message;
    let delaySeconds = settings.delaySeconds || 10;

    // If mode is ai_smart OR message is empty → use AI
    if (replyMode === 'ai_smart' || !replyMessage || replyMessage.trim() === '') {
        console.log(`[AutoReply] Using AI for reply (mode: ${replyMode})...`);
        try {
            const aiResponse = await aiService.generateSmartReply(igUserId, commentData.text, 'comment', commentData.username);
            replyMessage = aiResponse;

            // Random delay 10-50s for human-like timing
            delaySeconds = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
            console.log(`[AutoReply] AI Reply: "${replyMessage}" (delay: ${delaySeconds}s)`);
        } catch (err) {
            console.error('[AutoReply] AI generation failed:', err.message);
            replyMessage = '🔥';
        }
    }

    const delayMs = delaySeconds * 1000;
    console.log(`[AutoReply] Scheduling reply in ${delaySeconds}s for comment: ${commentData.commentId}`);

    // Add log entry as 'pending'
    const logEntry = await AutoReplyLog.create({
        commentId: commentData.commentId,
        commentText: commentData.text,
        commenterUsername: commentData.username,
        mediaId: commentData.mediaId,
        replyText: replyMessage,
        status: 'pending',
        action: 'replied',
        error: null,
        scheduledAt: new Date(),
        repliedAt: null
    });

    const timeoutId = setTimeout(async () => {
        const result = await replyToComment(commentData.commentId, replyMessage, tokenData.accessToken);

        // Update log entry in DB
        await AutoReplyLog.findByIdAndUpdate(logEntry._id, {
            status: result.success ? 'sent' : 'failed',
            repliedAt: new Date(),
            error: result.error || null,
            ...(result.replyId && { replyId: result.replyId })
        });

        pendingReplies.delete(commentData.commentId);
        console.log(`[AutoReply] Reply ${result.success ? 'sent' : 'failed'} for comment: ${commentData.commentId}`);
    }, delayMs);

    pendingReplies.set(commentData.commentId, timeoutId);
}

async function scheduleDMAutoReply(messageData, igUserId) {
    // Resolve ID mapping (webhook ID may differ from OAuth ID)
    igUserId = await resolveUserIdMapping(igUserId);

    const settings = await DmAutoReplySetting.findOne({ userId: igUserId });
    if (!settings || !settings.enabled) {
        console.log('[DM-AutoReply] DM auto-reply disabled for user:', igUserId);
        return;
    }

    const senderId = messageData.senderId;

    // Don't reply to own messages (echo prevention)
    if (senderId === igUserId) {
        console.log('[DM-AutoReply] Skipping echo (own message)');
        return;
    }

    // Don't reply if already pending
    if (pendingDMReplies.has(senderId)) {
        console.log('[DM-AutoReply] Already scheduled for sender:', senderId);
        return;
    }

    // Get access token for this user
    const tokenData = await Token.findOne({ userId: igUserId });
    if (!tokenData) {
        console.error('[DM-AutoReply] No access token found for user:', igUserId);
        await DmAutoReplyLog.create({
            senderId,
            messageText: messageData.text,
            replyText: settings.message,
            status: 'failed',
            error: 'No access token found',
            scheduledAt: new Date(),
            repliedAt: null
        });
        return;
    }

    let replyMessage = settings.message;
    let delaySeconds = settings.delaySeconds || 10;

    // If message is empty, use AI
    if (!replyMessage || replyMessage.trim() === '') {
        console.log('[DM-AutoReply] Message empty, using AI generation...');
        try {
            const aiResponse = await aiService.generateSmartReply(igUserId, messageData.text, 'dm', 'there');
            replyMessage = aiResponse;
            // Random delay 4-5s
            delaySeconds = Math.floor(Math.random() * (5 - 4 + 1)) + 4;
            console.log(`[DM-AutoReply] AI Reply generated: "${replyMessage}"`);
        } catch (err) {
            console.error('[DM-AutoReply] AI generation failed:', err.message);
            replyMessage = "Thanks for reaching out! ❤️";
        }
    }

    const delayMs = delaySeconds * 1000;
    console.log(`[DM-AutoReply] Scheduling DM reply in ${delaySeconds}s for sender: ${senderId}`);

    // Add log entry as 'pending'
    const logEntry = await DmAutoReplyLog.create({
        senderId,
        messageText: messageData.text,
        replyText: replyMessage,
        status: 'pending',
        error: null,
        scheduledAt: new Date(),
        repliedAt: null
    });

    const timeoutId = setTimeout(async () => {
        const result = await sendDirectMessage(igUserId, senderId, replyMessage, tokenData.accessToken);

        // Update log entry in DB
        await DmAutoReplyLog.findByIdAndUpdate(logEntry._id, {
            status: result.success ? 'sent' : 'failed',
            repliedAt: new Date(),
            error: result.error || null
        });

        pendingDMReplies.delete(senderId);
        console.log(`[DM-AutoReply] DM reply ${result.success ? 'sent' : 'failed'} for sender: ${senderId}`);
    }, delayMs);

    pendingDMReplies.set(senderId, timeoutId);
}

function parseSignedRequest(signedRequest) {
    try {
        const [encodedSig, payload] = signedRequest.split('.');
        const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

        const expectedSig = crypto
            .createHmac('sha256', INSTAGRAM_CONFIG.appSecret)
            .update(payload)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        if (encodedSig !== expectedSig) {
            console.error('[Meta] Signed request signature mismatch');
            return null;
        }

        return data;
    } catch (error) {
        console.error('[Meta] Failed to parse signed_request:', error.message);
        return null;
    }
}

// ==================== OAUTH ROUTES ====================

// Route: Get OAuth URL
router.get('/auth', (req, res) => {
    try {
        const params = new URLSearchParams({
            client_id: INSTAGRAM_CONFIG.appId,
            redirect_uri: INSTAGRAM_CONFIG.redirectUri,
            scope: INSTAGRAM_CONFIG.scopes.join(','),
            response_type: 'code'
        });

        const authUrl = `${INSTAGRAM_CONFIG.oauthBaseUrl}/authorize?${params.toString()}`;

        console.log('[OAuth] Generated authorization URL');

        res.json({
            success: true,
            authUrl,
            message: 'Redirect user to this URL to authorize'
        });
    } catch (error) {
        console.error('[OAuth] Auth URL generation error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate auth URL',
            message: error.message
        });
    }
});

// Route: Handle OAuth Callback
router.get('/callback', async (req, res) => {
    try {
        const { code, error, error_reason, error_description } = req.query;

        if (error) {
            console.error('[OAuth] Instagram OAuth error:', error_reason, error_description);
            return res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=${error}&reason=${error_reason}`);
        }

        if (!code) {
            return res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=no_code`);
        }

        console.log('[OAuth] Received authorization code');

        // Step 1: Exchange code for short-lived token
        console.log('[OAuth] Exchanging code for token');
        const tokenResponse = await axios.post(
            `${INSTAGRAM_CONFIG.oauthBaseUrl}/access_token`,
            new URLSearchParams({
                client_id: INSTAGRAM_CONFIG.appId,
                client_secret: INSTAGRAM_CONFIG.appSecret,
                grant_type: 'authorization_code',
                redirect_uri: INSTAGRAM_CONFIG.redirectUri,
                code
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const shortLivedToken = tokenResponse.data.access_token;
        const userId = tokenResponse.data.user_id;
        console.log('[OAuth] Short-lived token received for user:', userId);

        // Step 2: Exchange for long-lived token (60 days)
        console.log('[OAuth] Getting long-lived token');
        const longLivedResponse = await axios.get(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/access_token`,
            {
                params: {
                    grant_type: 'ig_exchange_token',
                    client_secret: INSTAGRAM_CONFIG.appSecret,
                    access_token: shortLivedToken
                }
            }
        );

        const longLivedToken = longLivedResponse.data.access_token;
        const expiresIn = longLivedResponse.data.expires_in;
        console.log('[OAuth] Long-lived token received (expires in', expiresIn, 'seconds)');

        // Store token in MongoDB
        const userIdStr = String(userId);
        await Token.findOneAndUpdate(
            { userId: userIdStr },
            {
                userId: userIdStr,
                accessToken: longLivedToken,
                expiresIn,
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );

        // Auto-trigger persona analysis in background (non-blocking)
        console.log('[OAuth] Triggering persona analysis in background...');
        aiService.analyzeProfile(userIdStr, longLivedToken)
            .then(result => console.log('[OAuth] Persona analysis result:', JSON.stringify(result)))
            .catch(err => console.error('[OAuth] Persona analysis failed:', err.message));

        // Redirect to frontend with token and userId
        res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?token=${longLivedToken}&userId=${userIdStr}&expiresIn=${expiresIn}`);

    } catch (error) {
        console.error('[OAuth] Callback error:', error.response?.data || error.message);
        res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
    }
});

// ==================== USER PROFILE ROUTE ====================

// Route: Get User Profile (using stored token)
router.get('/profile', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        console.log('[Profile] Fetching profile data...');

        // Fetch user profile from Instagram Graph API
        const response = await axios.get(`${INSTAGRAM_CONFIG.graphBaseUrl}/me`, {
            params: {
                fields: 'id,username,account_type,media_count,followers_count,follows_count,biography,profile_picture_url',
                access_token: token
            }
        });

        console.log('[Profile] Profile fetched for:', response.data.username);

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('[Profile] Fetch error:', error.response?.data || error.message);

        // Handle token expiry
        if (error.response?.data?.error?.code === 190) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 190
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile',
            message: error.message
        });
    }
});

// ==================== PERSONA / AI ANALYSIS ROUTES ====================

// Route: Manually trigger persona analysis
router.post('/analyze-style', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const { userId } = req.body;

        if (!token || !userId) {
            return res.status(400).json({
                success: false,
                error: 'token and userId are required'
            });
        }

        console.log(`[Persona] Manual analysis triggered for user: ${userId}`);
        const result = await aiService.analyzeProfile(userId, token);

        res.json({
            success: result.success,
            data: result
        });

    } catch (error) {
        console.error('[Persona] Analysis endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Analysis failed',
            message: error.message
        });
    }
});

// Route: Get persona status and details
router.get('/persona-status', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId query param required' });
        }

        const persona = await CreatorPersona.findOne({ userId });

        if (!persona) {
            return res.json({
                success: true,
                hasPersona: false,
                message: 'No persona found. Connect Instagram and it will auto-analyze.'
            });
        }

        res.json({
            success: true,
            hasPersona: true,
            dataSource: persona.dataSource,
            replyPairsAnalyzed: persona.replyPairsAnalyzed,
            analysisTimestamp: persona.analysisTimestamp,
            communicationStyle: persona.communicationStyle,
            replyStyle: persona.replyStyle,
            emojiFrequency: persona.emojiFrequency,
            averageReplyLength: persona.averageReplyLength,
            lowercasePreference: persona.lowercasePreference,
            slangPatterns: persona.slangPatterns,
            toneKeywords: persona.toneKeywords
        });

    } catch (error) {
        console.error('[Persona] Status endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch persona status',
            message: error.message
        });
    }
});

// ==================== WEBHOOK ROUTES ====================

// Route: Verify Webhook (required by Facebook)
router.get('/webhook', (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log('[Webhook] Verification request received');
        console.log('[Webhook] Mode:', mode);
        console.log('[Webhook] Received token:', token);
        console.log('[Webhook] Expected token:', WEBHOOK_VERIFY_TOKEN);
        console.log('[Webhook] Token match:', token === WEBHOOK_VERIFY_TOKEN);
        console.log('[Webhook] WEBHOOK_VERIFY_TOKEN env set:', !!WEBHOOK_VERIFY_TOKEN);

        if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
            console.log('[Webhook] Verification successful, sending challenge:', challenge);
            res.status(200).send(challenge);
        } else {
            console.error('[Webhook] Verification failed - token mismatch or wrong mode');
            res.sendStatus(403);
        }
    } catch (error) {
        console.error('[Webhook] Verification error:', error.message);
        res.sendStatus(500);
    }
});

// Route: Receive Webhook Events (messages, reactions, etc.)
router.post('/webhook', async (req, res) => {
    try {
        // Verify the webhook signature from Instagram
        if (!verifyWebhookSignature(req)) {
            console.error('[Webhook] Request rejected - invalid signature');
            return res.sendStatus(403);
        }

        const body = req.body;

        console.log('[Webhook] Event received:', JSON.stringify(body, null, 2));

        // Track webhook events in DB
        await WebhookEvent.create({
            receivedAt: new Date(),
            object: body.object,
            entryCount: body.entry?.length || 0,
            raw: JSON.stringify(body).substring(0, 500)
        });

        // Keep only last 50 webhook events
        const totalEvents = await WebhookEvent.countDocuments();
        if (totalEvents > 50) {
            const oldEvents = await WebhookEvent.find().sort({ receivedAt: 1 }).limit(totalEvents - 50);
            const oldIds = oldEvents.map(e => e._id);
            await WebhookEvent.deleteMany({ _id: { $in: oldIds } });
        }

        if (body.object === 'instagram') {
            for (const entry of body.entry) {
                const igUserId = String(entry.id);

                // ---- Handle Comment Events (changes array) ----
                const changes = entry.changes || [];
                for (const change of changes) {
                    if (change.field === 'comments') {
                        const commentValue = change.value;
                        console.log('[Webhook] Comment event received:', JSON.stringify(commentValue, null, 2));

                        const commentData = {
                            commentId: commentValue.comment_id || commentValue.id,
                            text: commentValue.text,
                            username: commentValue.from?.username || 'unknown',
                            senderId: commentValue.from?.id,
                            mediaId: commentValue.media?.id,
                            mediaProductType: commentValue.media?.media_product_type,
                            parentId: commentValue.parent_id || null,
                            timestamp: commentValue.timestamp
                        };

                        console.log(`[Webhook] Comment from @${commentData.username}: "${commentData.text}"`);

                        // Trigger auto-reply if enabled
                        await scheduleAutoReply(commentData, igUserId);
                    }
                }

                // ---- Handle Messaging Events (messaging array) ----
                const messaging = entry.messaging || [];

                for (const event of messaging) {
                    const senderId = String(event.sender.id);
                    const recipientId = String(event.recipient.id);

                    // Handle message event
                    if (event.message) {
                        // Skip echo messages (messages sent BY the page account)
                        if (event.message.is_echo) {
                            console.log('[Webhook] Skipping echo message (sent by page)');
                            continue;
                        }

                        const messageData = {
                            messageId: event.message.mid,
                            senderId,
                            recipientId,
                            text: event.message.text || null,
                            attachments: event.message.attachments || [],
                            timestamp: event.timestamp,
                            received: new Date()
                        };

                        console.log('[Webhook] Message received from:', senderId);
                        console.log('[Webhook] Message text:', messageData.text);

                        // Store message in DB
                        await Message.create(messageData);

                        // Update conversation in DB
                        const conversationId = `${senderId}_${recipientId}`;
                        const existingConv = await Conversation.findOne({ conversationId });
                        const currentUnread = existingConv ? existingConv.unreadCount : 0;

                        await Conversation.findOneAndUpdate(
                            { conversationId },
                            {
                                conversationId,
                                senderId,
                                recipientId,
                                lastMessage: messageData,
                                lastMessageTime: event.timestamp,
                                unreadCount: currentUnread + 1
                            },
                            { upsert: true, new: true }
                        );

                        console.log('[Webhook] Message stored in DB');

                        // Trigger DM auto-reply
                        await scheduleDMAutoReply(messageData, igUserId);
                    }

                    // Handle reaction event
                    if (event.reaction) {
                        console.log('[Webhook] Reaction received:', event.reaction);
                    }

                    // Handle postback event (for quick replies)
                    if (event.postback) {
                        console.log('[Webhook] Postback received:', event.postback);
                    }
                }
            }

            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('[Webhook] Processing error:', error.message);
        res.status(500).send('ERROR');
    }
});

// ==================== MESSAGING ROUTES ====================

// Route: Send Message
router.post('/send-message', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const { recipientId, message } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        if (!recipientId || !message) {
            return res.status(400).json({
                success: false,
                error: 'recipientId and message are required'
            });
        }

        console.log('[Messaging] Sending message to:', recipientId);

        // Check if message is within 24-hour window
        const conversation = await Conversation.findOne({ senderId: recipientId });

        if (conversation) {
            const lastMessageTime = conversation.lastMessageTime;
            const hoursSinceLastMessage = (Date.now() - lastMessageTime) / (1000 * 60 * 60);

            if (hoursSinceLastMessage > 24) {
                return res.status(400).json({
                    success: false,
                    error: '24_HOUR_WINDOW_EXPIRED',
                    message: 'Cannot send message - 24 hour messaging window has expired',
                    lastMessageTime: new Date(lastMessageTime).toISOString(),
                    hoursSinceLastMessage: Math.round(hoursSinceLastMessage)
                });
            }
        }

        const response = await axios.post(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/me/messages`,
            {
                recipient: { id: recipientId },
                message: { text: message }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('[Messaging] Message sent successfully');

        res.json({
            success: true,
            data: response.data,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('[Messaging] Send error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to send message',
            message: error.message,
            details: error.response?.data
        });
    }
});

// Route: Get All Conversations
router.get('/conversations', async (req, res) => {
    try {
        console.log('[Messaging] Fetching all conversations');

        const allConversations = await Conversation.find().lean();

        const conversations = allConversations.map(conv => {
            const hoursSinceLastMessage = (Date.now() - conv.lastMessageTime) / (1000 * 60 * 60);
            const canReply = hoursSinceLastMessage <= 24;

            return {
                ...conv,
                canReply,
                hoursSinceLastMessage: Math.round(hoursSinceLastMessage),
                lastMessageTimeFormatted: new Date(conv.lastMessageTime).toISOString()
            };
        });

        // Sort by most recent first
        conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        console.log('[Messaging] Found', conversations.length, 'conversations');

        res.json({
            success: true,
            count: conversations.length,
            data: conversations
        });

    } catch (error) {
        console.error('[Messaging] Fetch conversations error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversations',
            message: error.message
        });
    }
});

// Route: Get Messages from a Specific Sender
router.get('/messages/:senderId', async (req, res) => {
    try {
        const { senderId } = req.params;

        console.log('[Messaging] Fetching messages from:', senderId);

        const messages = await Message.find({ senderId }).sort({ received: 1 }).lean();

        res.json({
            success: true,
            senderId,
            count: messages.length,
            data: messages
        });

    } catch (error) {
        console.error('[Messaging] Fetch messages error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages',
            message: error.message
        });
    }
});

// Route: Clear Message Store
router.delete('/messages/clear', async (req, res) => {
    try {
        await Message.deleteMany({});
        await Conversation.deleteMany({});

        console.log('[Messaging] Message stores cleared');

        res.json({
            success: true,
            message: 'Message stores cleared'
        });

    } catch (error) {
        console.error('[Messaging] Clear error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear messages',
            message: error.message
        });
    }
});

// ==================== COMMENT AUTO-REPLY ROUTES ====================

// Route: Save Auto-Reply Settings
router.post('/auto-reply/settings', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const { userId, enabled, delaySeconds, message, replyMode } = req.body;

        if (!token || !userId) {
            return res.status(400).json({
                success: false,
                error: 'token and userId are required'
            });
        }

        // Allow empty message for AI generation
        // if (!message || message.trim().length === 0) { ... }

        const delay = Math.min(Math.max(parseInt(delaySeconds) || 10, 5), 300);

        const validModes = ['reply_only', 'reply_and_hide', 'ai_smart'];
        const mode = validModes.includes(replyMode) ? replyMode : 'reply_only';

        await AutoReplySetting.findOneAndUpdate(
            { userId },
            {
                userId,
                enabled: Boolean(enabled),
                delaySeconds: delay,
                message: message ? message.trim() : '',
                replyMode: mode
            },
            { upsert: true, new: true }
        );

        // Always update token (needed for replying after server restart)
        await Token.findOneAndUpdate(
            { userId },
            {
                userId,
                accessToken: token,
                createdAt: new Date()
            },
            { upsert: true }
        );

        console.log(`[AutoReply] Settings saved for user ${userId}: enabled=${enabled}, delay=${delay}s, mode=${mode}`);

        // Sync settings to ALL other user IDs (fixes OAuth ID vs webhook ID mismatch)
        const settingsData = {
            enabled: Boolean(enabled),
            delaySeconds: delay,
            message: message ? message.trim() : '',
            replyMode: mode
        };

        const otherSettings = await AutoReplySetting.find({ userId: { $ne: userId } });
        for (const other of otherSettings) {
            await AutoReplySetting.findOneAndUpdate(
                { userId: other.userId },
                { ...settingsData, userId: other.userId },
                { upsert: true }
            );
            console.log(`[AutoReply] Settings synced to mapped ID ${other.userId}: mode=${mode}`);
        }

        const savedSettings = await AutoReplySetting.findOne({ userId }).lean();

        res.json({
            success: true,
            message: 'Auto-reply settings saved',
            data: savedSettings
        });

    } catch (error) {
        console.error('[AutoReply] Settings save error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings',
            message: error.message
        });
    }
});

// Route: Get Auto-Reply Settings
router.get('/auto-reply/settings', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId query param is required'
            });
        }

        const settings = await AutoReplySetting.findOne({ userId }).lean();

        res.json({
            success: true,
            data: settings || {
                enabled: false,
                delaySeconds: 10,
                message: 'Thanks for your comment! 🙏',
                replyMode: 'reply_only'
            }
        });

    } catch (error) {
        console.error('[AutoReply] Settings fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings',
            message: error.message
        });
    }
});

// Route: Get Auto-Reply Log
router.get('/auto-reply/log', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const logs = await AutoReplyLog.find().sort({ scheduledAt: -1 }).limit(limit).lean();
        const total = await AutoReplyLog.countDocuments();

        res.json({
            success: true,
            count: logs.length,
            total,
            pendingCount: pendingReplies.size,
            data: logs
        });

    } catch (error) {
        console.error('[AutoReply] Log fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch log',
            message: error.message
        });
    }
});

// Route: Clear Auto-Reply Log
router.delete('/auto-reply/log', async (req, res) => {
    try {
        // Cancel all pending replies
        for (const [commentId, timeoutId] of pendingReplies.entries()) {
            clearTimeout(timeoutId);
            console.log('[AutoReply] Cancelled pending reply for:', commentId);
        }
        pendingReplies.clear();

        await AutoReplyLog.deleteMany({});

        console.log('[AutoReply] Log cleared and pending replies cancelled');

        res.json({
            success: true,
            message: 'Auto-reply log cleared and pending replies cancelled'
        });

    } catch (error) {
        console.error('[AutoReply] Log clear error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear log',
            message: error.message
        });
    }
});

// ==================== DM AUTO-REPLY ROUTES ====================

// Route: Save DM Auto-Reply Settings
router.post('/dm-auto-reply/settings', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const { userId, enabled, delaySeconds, message } = req.body;

        if (!token || !userId) {
            return res.status(400).json({
                success: false,
                error: 'token and userId are required'
            });
        }

        // Allow empty message for AI generation
        // if (!message || message.trim().length === 0) { ... }

        const delay = Math.min(Math.max(parseInt(delaySeconds) || 10, 5), 300);

        await DmAutoReplySetting.findOneAndUpdate(
            { userId },
            {
                userId,
                enabled: Boolean(enabled),
                delaySeconds: delay,
                message: message ? message.trim() : ''
            },
            { upsert: true, new: true }
        );

        // Always update token (needed for replying after server restart)
        await Token.findOneAndUpdate(
            { userId },
            {
                userId,
                accessToken: token,
                createdAt: new Date()
            },
            { upsert: true }
        );

        console.log(`[DM-AutoReply] Settings saved for user ${userId}: enabled=${enabled}, delay=${delay}s`);

        const savedSettings = await DmAutoReplySetting.findOne({ userId }).lean();

        res.json({
            success: true,
            message: 'DM auto-reply settings saved',
            data: savedSettings
        });

    } catch (error) {
        console.error('[DM-AutoReply] Settings save error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to save DM auto-reply settings',
            message: error.message
        });
    }
});

// Route: Get DM Auto-Reply Settings
router.get('/dm-auto-reply/settings', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId query param is required'
            });
        }

        const settings = await DmAutoReplySetting.findOne({ userId }).lean();

        res.json({
            success: true,
            data: settings || {
                enabled: false,
                delaySeconds: 10,
                message: 'Thanks for reaching out! I will get back to you shortly.'
            }
        });

    } catch (error) {
        console.error('[DM-AutoReply] Settings fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch DM auto-reply settings',
            message: error.message
        });
    }
});

// Route: Get DM Auto-Reply Log
router.get('/dm-auto-reply/log', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const logs = await DmAutoReplyLog.find().sort({ scheduledAt: -1 }).limit(limit).lean();
        const total = await DmAutoReplyLog.countDocuments();

        res.json({
            success: true,
            count: logs.length,
            total,
            pendingCount: pendingDMReplies.size,
            data: logs
        });

    } catch (error) {
        console.error('[DM-AutoReply] Log fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch DM auto-reply log',
            message: error.message
        });
    }
});

// Route: Clear DM Auto-Reply Log
router.delete('/dm-auto-reply/log', async (req, res) => {
    try {
        // Cancel all pending DM replies
        for (const [senderId, timeoutId] of pendingDMReplies.entries()) {
            clearTimeout(timeoutId);
            console.log('[DM-AutoReply] Cancelled pending DM reply for:', senderId);
        }
        pendingDMReplies.clear();

        await DmAutoReplyLog.deleteMany({});

        console.log('[DM-AutoReply] DM log cleared and pending replies cancelled');

        res.json({
            success: true,
            message: 'DM auto-reply log cleared and pending replies cancelled'
        });

    } catch (error) {
        console.error('[DM-AutoReply] Log clear error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear DM auto-reply log',
            message: error.message
        });
    }
});

// ==================== WEBHOOK SUBSCRIPTION ====================

// Route: Subscribe to webhook fields
router.post('/subscribe-webhooks', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        // Get the user's Instagram ID and store the token
        let igUserId = null;
        try {
            const meResponse = await axios.get(`${INSTAGRAM_CONFIG.graphBaseUrl}/me`, {
                params: { fields: 'id', access_token: token }
            });
            igUserId = String(meResponse.data.id);
            console.log('[Webhooks] Resolved IG user ID:', igUserId);

            // Store token in DB
            await Token.findOneAndUpdate(
                { userId: igUserId },
                {
                    userId: igUserId,
                    accessToken: token,
                    createdAt: new Date()
                },
                { upsert: true }
            );
            console.log('[Webhooks] Token stored for user:', igUserId);
        } catch (meErr) {
            console.error('[Webhooks] Could not resolve user ID:', meErr.response?.data || meErr.message);
        }

        console.log('[Webhooks] Subscribing to webhook fields: comments, messages');

        const response = await axios.post(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/me/subscribed_apps`,
            null,
            {
                params: {
                    subscribed_fields: 'comments,messages',
                    access_token: token
                }
            }
        );

        console.log('[Webhooks] Subscription response:', JSON.stringify(response.data));

        res.json({
            success: true,
            message: 'Webhook subscriptions enabled for comments and messages',
            data: response.data,
            igUserId: igUserId,
            tokenStored: !!igUserId
        });

    } catch (error) {
        console.error('[Webhooks] Subscription error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to subscribe to webhooks',
            message: error.message,
            details: error.response?.data
        });
    }
});

// ==================== PROFILE & MEDIA ROUTES ====================

// Route: Get Profile Data
router.get('/profile', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
                message: 'Pass token as query param ?token=XXX or Authorization header'
            });
        }

        console.log('[Profile] Fetching profile data');

        const fields = 'id,username,account_type,media_count,followers_count,follows_count,profile_picture_url,biography,website';

        const response = await axios.get(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/me`,
            {
                params: {
                    fields,
                    access_token: token
                }
            }
        );

        console.log('[Profile] Profile data fetched for user:', response.data.username);

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('[Profile] Fetch error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch profile',
            message: error.message,
            details: error.response?.data
        });
    }
});

// Route: Get Media (Posts & Reels)
router.get('/media', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const limit = req.query.limit || 25;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
                message: 'Pass token as query param ?token=XXX or Authorization header'
            });
        }

        console.log('[Media] Fetching media data');

        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,is_shared_to_feed';

        const response = await axios.get(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/me/media`,
            {
                params: {
                    fields,
                    limit,
                    access_token: token
                }
            }
        );

        const media = response.data.data || [];

        // Separate posts and reels
        const posts = media.filter(m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');
        const reels = media.filter(m => m.media_type === 'VIDEO');

        console.log(`[Media] Media fetched: ${posts.length} posts, ${reels.length} reels`);

        res.json({
            success: true,
            total: media.length,
            posts: posts.length,
            reels: reels.length,
            data: media,
            paging: response.data.paging
        });

    } catch (error) {
        console.error('[Media] Fetch error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch media',
            message: error.message,
            details: error.response?.data
        });
    }
});

// ==================== META PLATFORM CALLBACKS ====================

// Route: Deauthorize Callback
router.post('/deauthorize', async (req, res) => {
    try {
        const { signed_request } = req.body;

        if (signed_request) {
            const data = parseSignedRequest(signed_request);
            if (data && data.user_id) {
                console.log('[Deauthorize] User removed app, user_id:', data.user_id);

                // Remove stored data from DB
                await Token.deleteOne({ userId: data.user_id });
                await Message.deleteMany({ senderId: data.user_id });
            }
        }

        console.log('[Deauthorize] Callback processed successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('[Deauthorize] Error:', error.message);
        res.json({ success: true });
    }
});

// Route: Data Deletion Request (GDPR/CCPA compliance)
router.post('/data-deletion', async (req, res) => {
    try {
        const { signed_request } = req.body;
        let userId = 'unknown';

        if (signed_request) {
            const data = parseSignedRequest(signed_request);
            if (data && data.user_id) {
                userId = data.user_id;
                console.log('[DataDeletion] Request received for user_id:', userId);

                // Delete all user data from DB
                await Token.deleteOne({ userId });
                await Message.deleteMany({ senderId: userId });
                await Conversation.deleteMany({
                    $or: [{ senderId: userId }, { recipientId: userId }]
                });
                await AutoReplySetting.deleteOne({ userId });
                await DmAutoReplySetting.deleteOne({ userId });
            }
        }

        const confirmationCode = `DEL-${userId}-${Date.now()}`;
        const statusUrl = `${INSTAGRAM_CONFIG.frontendUrl}/data-deletion?code=${confirmationCode}`;

        console.log('[DataDeletion] Processed. Code:', confirmationCode);

        res.json({
            url: statusUrl,
            confirmation_code: confirmationCode
        });
    } catch (error) {
        console.error('[DataDeletion] Error:', error.message);
        res.json({
            url: `${INSTAGRAM_CONFIG.frontendUrl}/data-deletion`,
            confirmation_code: `DEL-error-${Date.now()}`
        });
    }
});

// ==================== DEBUG ROUTES ====================

// Route: Debug Status
router.get('/debug/status', async (req, res) => {
    try {
        const tokens = await Token.find().lean();
        const tokenEntries = tokens.map(t => ({
            userId: t.userId,
            hasToken: !!t.accessToken,
            tokenPreview: t.accessToken ? t.accessToken.substring(0, 20) + '...' : null,
            createdAt: t.createdAt
        }));

        const commentSettings = await AutoReplySetting.find().lean();
        const dmSettings = await DmAutoReplySetting.find().lean();
        const recentCommentLog = await AutoReplyLog.find().sort({ scheduledAt: -1 }).limit(5).lean();
        const recentDmLog = await DmAutoReplyLog.find().sort({ scheduledAt: -1 }).limit(5).lean();
        const totalCommentLogs = await AutoReplyLog.countDocuments();
        const totalDmLogs = await DmAutoReplyLog.countDocuments();
        const webhookEvents = await WebhookEvent.find().sort({ receivedAt: -1 }).limit(10).lean();
        const totalWebhookEvents = await WebhookEvent.countDocuments();

        res.json({
            success: true,
            serverUptime: Math.round(process.uptime()) + 's',
            database: 'MongoDB connected',
            tokens: {
                count: tokens.length,
                entries: tokenEntries
            },
            commentAutoReply: {
                settingsCount: commentSettings.length,
                settings: commentSettings,
                logCount: totalCommentLogs,
                pendingReplies: pendingReplies.size,
                recentLog: recentCommentLog
            },
            dmAutoReply: {
                settingsCount: dmSettings.length,
                settings: dmSettings,
                logCount: totalDmLogs,
                pendingReplies: pendingDMReplies.size,
                recentLog: recentDmLog
            },
            webhooks: {
                totalEventsReceived: totalWebhookEvents,
                recentEvents: webhookEvents
            }
        });
    } catch (error) {
        console.error('[Debug] Status error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Test Comment Webhook (simulates a comment webhook)
router.post('/debug/test-comment-webhook', async (req, res) => {
    try {
        const { userId, commentText, commentId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required (your Instagram user ID)'
            });
        }

        const testCommentData = {
            commentId: commentId || `test_${Date.now()}`,
            text: commentText || 'This is a test comment',
            username: 'test_user',
            senderId: 'test_sender',
            mediaId: 'test_media',
            mediaProductType: 'FEED',
            parentId: null,
            timestamp: Date.now()
        };

        const settings = await AutoReplySetting.findOne({ userId }).lean();
        const tokenData = await Token.findOne({ userId }).lean();

        // Run the auto-reply flow
        await scheduleAutoReply(testCommentData, userId);

        res.json({
            success: true,
            message: 'Test comment webhook simulated',
            debug: {
                userId,
                settingsFound: !!settings,
                settingsEnabled: settings?.enabled || false,
                tokenFound: !!tokenData,
                commentData: testCommentData
            }
        });

    } catch (error) {
        console.error('[Debug] Test webhook error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Route: Test DM Webhook (simulates a DM webhook)
router.post('/debug/test-dm-webhook', async (req, res) => {
    try {
        const { userId, messageText, senderId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required (your Instagram user ID)'
            });
        }

        const testMessageData = {
            id: `test_msg_${Date.now()}`,
            senderId: senderId || 'test_sender_123',
            recipientId: userId,
            text: messageText || 'This is a test DM',
            attachments: [],
            timestamp: Date.now(),
            received: new Date()
        };

        const settings = await DmAutoReplySetting.findOne({ userId }).lean();
        const tokenData = await Token.findOne({ userId }).lean();

        // Run the DM auto-reply flow
        await scheduleDMAutoReply(testMessageData, userId);

        res.json({
            success: true,
            message: 'Test DM webhook simulated',
            debug: {
                userId,
                settingsFound: !!settings,
                settingsEnabled: settings?.enabled || false,
                tokenFound: !!tokenData,
                messageData: testMessageData
            }
        });

    } catch (error) {
        console.error('[Debug] Test DM webhook error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==================== BRAND DEAL MARKETPLACE ROUTES ====================

const Campaign = require('../model/Campaign');
const DealApplication = require('../model/DealApplication');
const affiliateApiService = require('../service/affiliateApiService');
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// Route: List open campaigns (with filters)
router.get('/campaigns', async (req, res) => {
    try {
        const { niche, compensationType, minBudget, maxBudget, status, page = 1, limit = 20 } = req.query;

        const filter = { status: status || 'open' };
        if (niche) filter.targetNiche = new RegExp(niche, 'i');
        if (compensationType) filter.compensationType = compensationType;
        if (minBudget) filter.budgetMax = { $gte: parseInt(minBudget) };
        if (maxBudget) filter.budgetMin = { $lte: parseInt(maxBudget) };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const campaigns = await Campaign.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Campaign.countDocuments(filter);

        res.json({
            success: true,
            campaigns,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });

    } catch (error) {
        console.error('[Marketplace] List campaigns error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CJ AFFILIATE SYNC ROUTES (must be before :id) ====================

// Route: Sync deals from CJ Affiliate (specific keywords)
router.post('/campaigns/sync-cj', async (req, res) => {
    try {
        const { keywords, category, limit, joinedOnly } = req.body;
        console.log(`[CJ Sync] Manual sync triggered — keywords: ${keywords || 'none'}, category: ${category || 'none'}`);

        const result = await affiliateApiService.syncCJDealsToDatabase({
            keywords, category,
            limit: limit || 100,
            joinedOnly: joinedOnly || false
        });

        res.json({
            success: true,
            message: `Synced ${result.synced} new deals, updated ${result.skipped}, ${result.errors} errors`,
            ...result
        });
    } catch (error) {
        console.error('[CJ Sync] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Sync ALL niches from CJ
router.post('/campaigns/sync-all', async (req, res) => {
    try {
        console.log('[CJ Sync] Full sync triggered — all niches');
        const result = await affiliateApiService.syncAllNiches();

        res.json({
            success: true,
            message: `Synced ${result.totalSynced} deals across ${result.niches} niches`,
            ...result
        });
    } catch (error) {
        console.error('[CJ Sync] Full sync error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Get CJ sync stats
router.get('/campaigns/cj-stats', async (req, res) => {
    try {
        const cjCount = await Campaign.countDocuments({ source: 'cj' });
        const manualCount = await Campaign.countDocuments({ source: 'manual' });
        const impactCount = await Campaign.countDocuments({ source: 'impact' });
        const total = await Campaign.countDocuments({});

        res.json({
            success: true,
            stats: { total, cj: cjCount, manual: manualCount, impact: impactCount }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CAMPAIGN :id ROUTES (must be after literal routes) ====================

// Route: Get single campaign by ID
router.get('/campaigns/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID format' });
        }

        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

        // Increment views
        await Campaign.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });

        res.json({ success: true, campaign });
    } catch (error) {
        console.error('[Marketplace] Get campaign error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Create campaign (admin)
router.post('/campaigns', async (req, res) => {
    try {
        const {
            brandName, brandLogo, brandWebsite, brandDescription,
            title, description, deliverables, requirements, guidelines,
            budgetMin, budgetMax, currency, compensationType,
            targetNiche, targetSubNiches, minFollowers, maxFollowers,
            category, tags, applicationDeadline,
            campaignStartDate, campaignEndDate, contactEmail, status
        } = req.body;

        if (!brandName || !title || !description || !targetNiche) {
            return res.status(400).json({ success: false, error: 'brandName, title, description, and targetNiche are required' });
        }

        const campaign = await Campaign.create({
            brandName, brandLogo, brandWebsite, brandDescription,
            title, description, deliverables, requirements, guidelines,
            budgetMin: budgetMin || 0, budgetMax: budgetMax || 0,
            currency: currency || 'USD', compensationType: compensationType || 'paid',
            targetNiche, targetSubNiches: targetSubNiches || [],
            minFollowers: minFollowers || 1000, maxFollowers: maxFollowers || 1000000,
            category: category || targetNiche, tags: tags || [],
            applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
            campaignStartDate: campaignStartDate ? new Date(campaignStartDate) : null,
            campaignEndDate: campaignEndDate ? new Date(campaignEndDate) : null,
            contactEmail: contactEmail || '', status: status || 'open',
            createdBy: 'admin'
        });

        console.log(`[Marketplace] Campaign created: "${title}" by ${brandName}`);
        res.status(201).json({ success: true, campaign });

    } catch (error) {
        console.error('[Marketplace] Create campaign error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Update campaign (admin)
router.put('/campaigns/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID format' });
        }

        const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

        res.json({ success: true, campaign });
    } catch (error) {
        console.error('[Marketplace] Update campaign error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Get AI match score for a campaign
router.get('/campaigns/:id/match-score', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID format' });
        }

        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const userId = req.query.userId;
        if (!token || !userId) return res.status(400).json({ success: false, error: 'token and userId required' });

        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

        const creatorData = await brandDealService.collectCreatorData(userId, token);
        const match = await brandDealService.calculateMatchScore(campaign, creatorData);

        res.json({ success: true, matchScore: match.score, matchReasons: match.reasons });

    } catch (error) {
        console.error('[Marketplace] Match score error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Generate AI pitch for a campaign
router.post('/campaigns/:id/generate-pitch', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID format' });
        }

        const token = req.query.token || req.body.token || req.headers.authorization?.replace('Bearer ', '');
        const { userId } = req.body;
        if (!token || !userId) return res.status(400).json({ success: false, error: 'token and userId required' });

        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

        const creatorData = await brandDealService.collectCreatorData(userId, token);
        const pitch = await brandDealService.generateApplicationPitch(campaign, creatorData);

        res.json({ success: true, pitch });

    } catch (error) {
        console.error('[Marketplace] Pitch generation error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Apply to a campaign (full end-to-end)
router.post('/campaigns/:id/apply', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID format' });
        }

        const token = req.query.token || req.body.token || req.headers.authorization?.replace('Bearer ', '');
        const { userId, personalNote } = req.body;
        if (!token || !userId) return res.status(400).json({ success: false, error: 'token and userId required' });

        console.log(`[Marketplace] Application: user ${userId} → campaign ${req.params.id}`);
        const result = await brandDealService.submitApplication(req.params.id, userId, token, personalNote);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('[Marketplace] Apply error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Get creator's applications
router.get('/my-applications', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

        const applications = await DealApplication.find({ creatorId: userId })
            .sort({ appliedAt: -1 })
            .populate('campaignId');

        res.json({
            success: true,
            applications: applications.map(app => ({
                id: app._id,
                campaign: app.campaignId ? {
                    id: app.campaignId._id,
                    brandName: app.campaignId.brandName,
                    title: app.campaignId.title,
                    compensationType: app.campaignId.compensationType,
                    budgetMin: app.campaignId.budgetMin,
                    budgetMax: app.campaignId.budgetMax,
                    currency: app.campaignId.currency,
                    status: app.campaignId.status
                } : null,
                matchScore: app.matchScore,
                matchReasons: app.matchReasons,
                pitch: app.pitch,
                applicationStatus: app.applicationStatus,
                appliedAt: app.appliedAt,
                reviewedAt: app.reviewedAt
            })),
            total: applications.length
        });

    } catch (error) {
        console.error('[Marketplace] My applications error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});



module.exports = router;
