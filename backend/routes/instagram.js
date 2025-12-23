const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/instagram/auth
// @desc    Get Instagram OAuth URL
router.get('/auth', authMiddleware, instagramController.initiateAuth);

// @route   GET /api/instagram/callback
// @desc    Handle Instagram OAuth callback
router.get('/callback', authMiddleware, instagramController.handleCallback);

// @route   GET /api/instagram/profile
// @desc    Get connected Instagram profile
router.get('/profile', authMiddleware, instagramController.getProfile);

// @route   GET /api/instagram/media
// @desc    Get user's Instagram media
router.get('/media', authMiddleware, instagramController.getUserMedia);

// @route   DELETE /api/instagram/disconnect
// @desc    Disconnect Instagram account
router.delete('/disconnect', authMiddleware, instagramController.disconnect);

module.exports = router;
