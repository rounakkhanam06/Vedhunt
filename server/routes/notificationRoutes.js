const express = require('express');
const router = express.Router();
const { getMyNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getMyNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;
