const express = require('express');
const router = express.Router();
const chatService = require('../service/chatService');

// ==================== CHAT API ROUTES ====================

// POST /api/chat/message — Process a chat message
router.post('/message', async (req, res) => {
    try {
        const { userId, message, token } = req.body;

        if (!userId || !message) {
            return res.status(400).json({
                success: false,
                error: 'userId and message are required'
            });
        }

        if (message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message cannot be empty'
            });
        }

        console.log(`[ChatAPI] Message from ${userId}: "${message}"`);

        const result = await chatService.processMessage(userId, message.trim(), token);

        res.json(result);
    } catch (error) {
        console.error('[ChatAPI] Error processing message:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to process message',
            message: error.message,
            response: 'Sorry, something went wrong. Please try again!',
            toasts: [{
                type: 'error',
                title: 'Error',
                message: 'Failed to process your message. Please try again.'
            }],
            actions: []
        });
    }
});

// GET /api/chat/history/:userId — Get chat history
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const result = await chatService.getChatHistory(userId, limit);

        res.json(result);
    } catch (error) {
        console.error('[ChatAPI] Error fetching history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chat history',
            message: error.message
        });
    }
});

// GET /api/chat/active-count/:userId — Get count of active automations (for sidebar badge)
router.get('/active-count/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const AutoReplySetting = require('../model/Instaautomation').AutoReplySetting;
        const DmAutoReplySetting = require('../model/Instaautomation').DmAutoReplySetting;

        const [commentSettings, dmSettings] = await Promise.all([
            AutoReplySetting.findOne({ userId }).lean(),
            DmAutoReplySetting.findOne({ userId }).lean()
        ]);

        let activeCount = 0;
        const activeList = [];

        if (commentSettings?.enabled) {
            activeCount++;
            activeList.push('💬 Comments');
        }
        if (dmSettings?.enabled) {
            activeCount++;
            activeList.push('✉️ DMs');
        }

        res.json({ success: true, activeCount, activeList });
    } catch (error) {
        res.json({ success: true, activeCount: 0, activeList: [] });
    }
});

// GET /api/chat/quota — Get Gemini API usage
router.get('/quota', async (req, res) => {
    try {
        const { getGeminiUsage } = require('../service/quotaService');
        const { getAvailableKeysCount } = require('../service/geminiClient');
        const used = await getGeminiUsage();
        const limit = 1500 * getAvailableKeysCount(); // 1500 requests per key per day
        res.json({ success: true, used, limit, remaining: Math.max(0, limit - used) });
    } catch (error) {
        res.json({ success: true, used: 0, limit: 1500, remaining: 1500 });
    }
});

module.exports = router;
