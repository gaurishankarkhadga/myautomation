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

module.exports = router;
