const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const authMiddleware = require('../middleware/auth');

// @route   POST /api/automation
// @desc    Create scheduled post
router.post('/', authMiddleware, automationController.createScheduledPost);

// @route   GET /api/automation
// @desc    Get all scheduled posts
router.get('/', authMiddleware, automationController.getScheduledPosts);

// @route   PUT /api/automation/:id
// @desc    Update scheduled post
router.put('/:id', authMiddleware, automationController.updateScheduledPost);

// @route   DELETE /api/automation/:id
// @desc    Cancel scheduled post
router.delete('/:id', authMiddleware, automationController.deleteScheduledPost);

// @route   POST /api/automation/:id/publish
// @desc    Publish post immediately
router.post('/:id/publish', authMiddleware, automationController.publishNow);

module.exports = router;
