const express = require('express');
const router = express.Router();
const User = require('../models/User');
const InstagramAccount = require('../models/InstagramAccount');
const ScheduledPost = require('../models/ScheduledPost');
const Analytics = require('../models/Analytics');

// @route   POST /api/data-deletion/callback
// @desc    Facebook Data Deletion Request Callback
router.post('/callback', async (req, res) => {
    try {
        const { signed_request } = req.body;

        // In production, verify signed_request signature
        // For now, accepting the request

        const confirmationCode = 'DEL-' + Date.now();

        res.json({
            url: `${process.env.FRONTEND_URL}/data-deletion?status=pending&code=${confirmationCode}`,
            confirmation_code: confirmationCode
        });
    } catch (error) {
        console.error('Data deletion callback error:', error);
        res.status(500).json({ error: 'Failed to process deletion request' });
    }
});

// @route   POST /api/data-deletion/request
// @desc    Manual data deletion request
router.post('/request', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete Instagram account data
        const instagramAccount = await InstagramAccount.findOne({ userId: user._id });
        if (instagramAccount) {
            await ScheduledPost.deleteMany({ userId: user._id });
            await Analytics.deleteMany({ instagramAccountId: instagramAccount._id });
            await InstagramAccount.deleteOne({ _id: instagramAccount._id });
        }

        // Delete user
        await User.deleteOne({ _id: user._id });

        res.json({
            success: true,
            message: 'All data deleted successfully',
            confirmationCode: 'DEL-' + Date.now()
        });
    } catch (error) {
        console.error('Manual deletion error:', error);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

module.exports = router;
