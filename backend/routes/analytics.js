const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/analytics/overview
// @desc    Get analytics overview
router.get('/overview', authMiddleware, analyticsController.getOverview);

// @route   POST /api/analytics/sync
// @desc    Sync latest Instagram insights
router.post('/sync', authMiddleware, analyticsController.syncInsights);

// @route   GET /api/analytics/insights
// @desc    Get historical insights
router.get('/insights', authMiddleware, analyticsController.getInsights);

module.exports = router;
