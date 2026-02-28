const express = require('express');
const router = express.Router();
const youtubeService = require('../service/youtubeService');
const aiService = require('../service/aiService');
const {
    YTToken,
    YTAutoReplySetting,
    YTAutoReplyLog,
    YTProcessedComment
} = require('../model/YoutubeAutomation');

// In-memory trackers
const pendingYTReplies = new Map();
let pollingInterval = null;
let pollingChannelId = null;

// ==================== HELPER: Get Authenticated Client ====================

async function getAuthenticatedClient(channelId) {
    const tokenData = await YTToken.findOne({ channelId });
    if (!tokenData) {
        throw new Error('No stored token for this channel');
    }

    // Check if token is expired (refresh if needed)
    const now = new Date();
    if (now >= tokenData.expiresAt) {
        console.log('[YouTube] Access token expired, refreshing...');
        try {
            const newCreds = await youtubeService.refreshAccessToken(tokenData.refreshToken);
            tokenData.accessToken = newCreds.access_token;
            tokenData.expiresAt = new Date(newCreds.expiry_date);
            if (newCreds.refresh_token) {
                tokenData.refreshToken = newCreds.refresh_token;
            }
            await tokenData.save();
            console.log('[YouTube] Token refreshed successfully');
        } catch (err) {
            console.error('[YouTube] Token refresh failed:', err.message);
            throw new Error('Token expired and refresh failed. Please reconnect YouTube.');
        }
    }

    return youtubeService.createAuthClient(
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiresAt
    );
}

// ==================== AUTO-REPLY SCHEDULING ====================

async function scheduleYTAutoReply(commentData, channelId) {
    const settings = await YTAutoReplySetting.findOne({ channelId });
    console.log(`[YT-AutoReply] Settings found for ${channelId}:`, settings ? 'Yes' : 'No');
    if (settings) console.log(`[YT-AutoReply] Enabled: ${settings.enabled}, Mode: ${settings.replyMode || 'reply_only'}`);

    if (!settings || !settings.enabled) {
        console.log('[YT-AutoReply] Auto-reply disabled for channel:', channelId);
        return;
    }

    // Don't reply if already pending/replied
    if (pendingYTReplies.has(commentData.commentId)) {
        console.log('[YT-AutoReply] Already scheduled for comment:', commentData.commentId);
        return;
    }

    const replyMode = settings.replyMode || 'reply_only';

    // Get auth client
    let authClient;
    try {
        authClient = await getAuthenticatedClient(channelId);
    } catch (err) {
        console.error('[YT-AutoReply] Auth error:', err.message);
        await YTAutoReplyLog.create({
            commentId: commentData.commentId,
            videoId: commentData.videoId,
            commentText: commentData.text,
            commenterName: commentData.authorName,
            replyText: '',
            status: 'failed',
            action: 'skipped',
            error: err.message,
            scheduledAt: new Date()
        });
        return;
    }

    // ==================== MODE: REPLY + SMART HIDE ====================
    if (replyMode === 'reply_and_hide') {
        console.log('[YT-AutoReply] Mode: reply_and_hide — analyzing comment with AI...');

        try {
            const analysis = await aiService.analyzeComment(commentData.text, commentData.authorName);

            if (analysis.shouldHide) {
                console.log(`[YT-AutoReply] Comment flagged as ${analysis.category}: "${analysis.reason}". Removing...`);

                // Try to reject the comment
                let result = await youtubeService.deleteComment(authClient, commentData.commentId);

                if (!result.success) {
                    console.log('[YT-AutoReply] Delete failed, trying moderation...');
                    result = await youtubeService.moderateComment(authClient, commentData.commentId, 'rejected');
                }

                await YTAutoReplyLog.create({
                    commentId: commentData.commentId,
                    videoId: commentData.videoId,
                    commentText: commentData.text,
                    commenterName: commentData.authorName,
                    replyText: `[REMOVED: ${analysis.category} — ${analysis.reason}]`,
                    status: result.success ? 'sent' : 'failed',
                    action: 'hidden',
                    error: result.error || null,
                    scheduledAt: new Date(),
                    repliedAt: new Date()
                });

                console.log(`[YT-AutoReply] Comment ${result.success ? 'removed' : 'removal failed'}: ${commentData.commentId}`);
                return;
            }

            console.log(`[YT-AutoReply] Comment is genuine (${analysis.category}). Proceeding to reply...`);
        } catch (err) {
            console.error('[YT-AutoReply] Comment analysis failed, defaulting to reply:', err.message);
        }
    }

    // ==================== DETERMINE REPLY MESSAGE & DELAY ====================
    let replyMessage = settings.message;
    let delaySeconds = settings.delaySeconds || 10;

    // If mode is ai_smart OR message is empty → use AI
    if (replyMode === 'ai_smart' || !replyMessage || replyMessage.trim() === '') {
        console.log(`[YT-AutoReply] Using AI for reply (mode: ${replyMode})...`);
        try {
            const aiResponse = await aiService.generateSmartReply(channelId, commentData.text, 'comment', commentData.authorName);
            replyMessage = aiResponse;

            // Random delay 10-50s for human-like timing
            delaySeconds = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
            console.log(`[YT-AutoReply] AI Reply: "${replyMessage}" (delay: ${delaySeconds}s)`);
        } catch (err) {
            console.error('[YT-AutoReply] AI generation failed:', err.message);
            replyMessage = '🔥';
        }
    }

    const delayMs = delaySeconds * 1000;
    console.log(`[YT-AutoReply] Scheduling reply in ${delaySeconds}s for comment: ${commentData.commentId}`);

    // Add log entry as 'pending'
    const logEntry = await YTAutoReplyLog.create({
        commentId: commentData.commentId,
        videoId: commentData.videoId,
        commentText: commentData.text,
        commenterName: commentData.authorName,
        replyText: replyMessage,
        status: 'pending',
        action: 'replied',
        error: null,
        scheduledAt: new Date(),
        repliedAt: null
    });

    const timeoutId = setTimeout(async () => {
        const result = await youtubeService.replyToComment(authClient, commentData.commentId, replyMessage);

        // Update log entry in DB
        await YTAutoReplyLog.findByIdAndUpdate(logEntry._id, {
            status: result.success ? 'sent' : 'failed',
            repliedAt: new Date(),
            error: result.error || null,
            ...(result.replyId && { replyId: result.replyId })
        });

        pendingYTReplies.delete(commentData.commentId);
        console.log(`[YT-AutoReply] Reply ${result.success ? 'sent' : 'failed'} for comment: ${commentData.commentId}`);
    }, delayMs);

    pendingYTReplies.set(commentData.commentId, timeoutId);
}

// ==================== POLLING ENGINE ====================

async function startPolling(channelId) {
    if (pollingInterval) {
        console.log('[YT-Polling] Polling already running, stopping old one...');
        clearInterval(pollingInterval);
    }

    const settings = await YTAutoReplySetting.findOne({ channelId });
    const intervalMs = (settings?.pollIntervalSeconds || 60) * 1000;

    pollingChannelId = channelId;

    console.log(`[YT-Polling] Starting comment polling for channel ${channelId} every ${intervalMs / 1000}s`);

    // Immediate first poll
    await pollForComments(channelId);

    // Then poll at interval
    pollingInterval = setInterval(async () => {
        await pollForComments(channelId);
    }, intervalMs);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        pollingChannelId = null;
        console.log('[YT-Polling] Polling stopped');
    }
}

async function pollForComments(channelId) {
    try {
        const authClient = await getAuthenticatedClient(channelId);

        // Get all processed comment IDs
        const processedDocs = await YTProcessedComment.find({ channelId }).select('commentId').lean();
        const processedIds = new Set(processedDocs.map(d => d.commentId));

        // Fetch new comments
        const newComments = await youtubeService.getNewComments(authClient, channelId, processedIds);

        console.log(`[YT-Polling] Poll result: ${newComments.length} new comments`);

        for (const comment of newComments) {
            // Mark as processed FIRST to prevent duplicates
            await YTProcessedComment.create({
                commentId: comment.commentId,
                channelId: channelId,
                processedAt: new Date()
            }).catch(() => { }); // Ignore duplicate key errors

            // Schedule auto-reply
            await scheduleYTAutoReply(comment, channelId);
        }

        // Cleanup old processed comments (keep last 500)
        const totalProcessed = await YTProcessedComment.countDocuments({ channelId });
        if (totalProcessed > 500) {
            const oldDocs = await YTProcessedComment.find({ channelId }).sort({ processedAt: 1 }).limit(totalProcessed - 500);
            const oldIds = oldDocs.map(d => d._id);
            await YTProcessedComment.deleteMany({ _id: { $in: oldIds } });
        }
    } catch (error) {
        console.error('[YT-Polling] Poll error:', error.message);
    }
}

// ==================== OAUTH ROUTES ====================

// Route: Get Google OAuth URL
router.get('/auth', (req, res) => {
    try {
        const authUrl = youtubeService.getAuthUrl();

        console.log('[YouTube-OAuth] Generated authorization URL');

        res.json({
            success: true,
            authUrl,
            message: 'Redirect user to this URL to authorize YouTube'
        });
    } catch (error) {
        console.error('[YouTube-OAuth] Auth URL generation error:', error.message);
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
        const { code, error: oauthError } = req.query;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

        if (oauthError) {
            console.error('[YouTube-OAuth] OAuth error:', oauthError);
            return res.redirect(`${FRONTEND_URL}/youtube?error=${oauthError}`);
        }

        if (!code) {
            return res.redirect(`${FRONTEND_URL}/youtube?error=no_code`);
        }

        console.log('[YouTube-OAuth] Received authorization code');

        // Exchange code for tokens
        const tokens = await youtubeService.getTokens(code);

        // Get channel info using the new token
        const authClient = youtubeService.createAuthClient(
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date
        );

        const channelInfo = await youtubeService.getChannelInfo(authClient);
        console.log('[YouTube-OAuth] Channel:', channelInfo.title, '(ID:', channelInfo.id, ')');

        // Store token in MongoDB
        await YTToken.findOneAndUpdate(
            { channelId: channelInfo.id },
            {
                channelId: channelInfo.id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(tokens.expiry_date),
                channelTitle: channelInfo.title,
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );

        console.log('[YouTube-OAuth] Token stored for channel:', channelInfo.id);

        // Redirect to frontend with channel ID
        res.redirect(`${FRONTEND_URL}/youtube?channelId=${channelInfo.id}&channelTitle=${encodeURIComponent(channelInfo.title)}`);

    } catch (error) {
        console.error('[YouTube-OAuth] Callback error:', error.message);
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${FRONTEND_URL}/youtube?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
    }
});

// ==================== CHANNEL PROFILE ROUTE ====================

router.get('/profile', async (req, res) => {
    try {
        const { channelId } = req.query;

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId query param required' });
        }

        const authClient = await getAuthenticatedClient(channelId);
        const channelInfo = await youtubeService.getChannelInfo(authClient);

        res.json({
            success: true,
            data: channelInfo
        });
    } catch (error) {
        console.error('[YouTube] Profile fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch channel profile',
            message: error.message
        });
    }
});

// ==================== VIDEO ROUTES ====================

router.get('/videos', async (req, res) => {
    try {
        const { channelId } = req.query;
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId query param required' });
        }

        const authClient = await getAuthenticatedClient(channelId);
        const videos = await youtubeService.getVideos(authClient, channelId, limit);

        res.json({
            success: true,
            count: videos.length,
            data: videos
        });
    } catch (error) {
        console.error('[YouTube] Videos fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch videos',
            message: error.message
        });
    }
});

// ==================== COMMENT ROUTES ====================

router.get('/comments/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const { channelId } = req.query;

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId query param required' });
        }

        const authClient = await getAuthenticatedClient(channelId);
        const comments = await youtubeService.getComments(authClient, videoId);

        res.json({
            success: true,
            videoId,
            count: comments.length,
            data: comments
        });
    } catch (error) {
        console.error('[YouTube] Comments fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch comments',
            message: error.message
        });
    }
});

// Route: Reply to a comment manually
router.post('/reply', async (req, res) => {
    try {
        const { channelId, parentId, text } = req.body;

        if (!channelId || !parentId || !text) {
            return res.status(400).json({
                success: false,
                error: 'channelId, parentId, and text are required'
            });
        }

        const authClient = await getAuthenticatedClient(channelId);
        const result = await youtubeService.replyToComment(authClient, parentId, text);

        res.json({
            success: result.success,
            data: result,
            message: result.success ? 'Reply sent successfully' : 'Failed to send reply'
        });
    } catch (error) {
        console.error('[YouTube] Reply error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to reply to comment',
            message: error.message
        });
    }
});

// Route: Moderate a comment
router.post('/moderate', async (req, res) => {
    try {
        const { channelId, commentId, action } = req.body;

        if (!channelId || !commentId || !action) {
            return res.status(400).json({
                success: false,
                error: 'channelId, commentId, and action are required'
            });
        }

        const validActions = ['heldForReview', 'published', 'rejected'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: `Invalid action. Must be one of: ${validActions.join(', ')}`
            });
        }

        const authClient = await getAuthenticatedClient(channelId);
        const result = await youtubeService.moderateComment(authClient, commentId, action);

        res.json({
            success: result.success,
            data: result,
            message: result.success ? `Comment ${action} successfully` : 'Failed to moderate comment'
        });
    } catch (error) {
        console.error('[YouTube] Moderation error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to moderate comment',
            message: error.message
        });
    }
});

// ==================== AUTO-REPLY SETTINGS ROUTES ====================

router.post('/auto-reply/settings', async (req, res) => {
    try {
        const { channelId, enabled, delaySeconds, message, replyMode } = req.body;

        if (!channelId) {
            return res.status(400).json({
                success: false,
                error: 'channelId is required'
            });
        }

        const delay = Math.min(Math.max(parseInt(delaySeconds) || 10, 5), 300);
        const validModes = ['reply_only', 'reply_and_hide', 'ai_smart'];
        const mode = validModes.includes(replyMode) ? replyMode : 'reply_only';

        await YTAutoReplySetting.findOneAndUpdate(
            { channelId },
            {
                channelId,
                enabled: Boolean(enabled),
                delaySeconds: delay,
                message: message ? message.trim() : '',
                replyMode: mode
            },
            { upsert: true, new: true }
        );

        console.log(`[YT-AutoReply] Settings saved for channel ${channelId}: enabled=${enabled}, delay=${delay}s, mode=${mode}`);

        // Auto-start/stop polling based on enabled state
        if (Boolean(enabled)) {
            await startPolling(channelId);
        } else {
            stopPolling();
        }

        const savedSettings = await YTAutoReplySetting.findOne({ channelId }).lean();

        res.json({
            success: true,
            message: 'YouTube auto-reply settings saved',
            data: savedSettings
        });
    } catch (error) {
        console.error('[YT-AutoReply] Settings save error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings',
            message: error.message
        });
    }
});

router.get('/auto-reply/settings', async (req, res) => {
    try {
        const { channelId } = req.query;

        if (!channelId) {
            return res.status(400).json({
                success: false,
                error: 'channelId query param is required'
            });
        }

        const settings = await YTAutoReplySetting.findOne({ channelId }).lean();

        res.json({
            success: true,
            data: settings || {
                enabled: false,
                delaySeconds: 10,
                message: 'Thanks for your comment! 🙏',
                replyMode: 'reply_only'
            },
            pollingActive: pollingInterval !== null && pollingChannelId === channelId
        });
    } catch (error) {
        console.error('[YT-AutoReply] Settings fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings',
            message: error.message
        });
    }
});

// ==================== AUTO-REPLY LOG ROUTES ====================

router.get('/auto-reply/log', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const logs = await YTAutoReplyLog.find().sort({ scheduledAt: -1 }).limit(limit).lean();
        const total = await YTAutoReplyLog.countDocuments();

        res.json({
            success: true,
            count: logs.length,
            total,
            pendingCount: pendingYTReplies.size,
            data: logs
        });
    } catch (error) {
        console.error('[YT-AutoReply] Log fetch error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch log',
            message: error.message
        });
    }
});

router.delete('/auto-reply/log', async (req, res) => {
    try {
        for (const [commentId, timeoutId] of pendingYTReplies.entries()) {
            clearTimeout(timeoutId);
            console.log('[YT-AutoReply] Cancelled pending reply for:', commentId);
        }
        pendingYTReplies.clear();

        await YTAutoReplyLog.deleteMany({});

        console.log('[YT-AutoReply] Log cleared and pending replies cancelled');

        res.json({
            success: true,
            message: 'YouTube auto-reply log cleared and pending replies cancelled'
        });
    } catch (error) {
        console.error('[YT-AutoReply] Log clear error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear log',
            message: error.message
        });
    }
});

// ==================== POLLING CONTROL ROUTES ====================

router.post('/auto-reply/start', async (req, res) => {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId is required' });
        }

        await startPolling(channelId);

        res.json({
            success: true,
            message: 'Comment polling started',
            channelId
        });
    } catch (error) {
        console.error('[YT-Polling] Start error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to start polling',
            message: error.message
        });
    }
});

router.post('/auto-reply/stop', async (req, res) => {
    try {
        stopPolling();

        res.json({
            success: true,
            message: 'Comment polling stopped'
        });
    } catch (error) {
        console.error('[YT-Polling] Stop error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to stop polling',
            message: error.message
        });
    }
});

// ==================== STATUS ROUTE ====================

router.get('/status', async (req, res) => {
    try {
        const { channelId } = req.query;

        const tokenExists = channelId ? await YTToken.findOne({ channelId }) : null;
        const settings = channelId ? await YTAutoReplySetting.findOne({ channelId }).lean() : null;

        res.json({
            success: true,
            connected: !!tokenExists,
            channelId: channelId || null,
            channelTitle: tokenExists?.channelTitle || null,
            autoReplyEnabled: settings?.enabled || false,
            pollingActive: pollingInterval !== null,
            pollingChannelId: pollingChannelId,
            pendingReplies: pendingYTReplies.size
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
