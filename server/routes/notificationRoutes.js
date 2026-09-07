const express = require('express');
const router = express.Router();
const { getMyNotifications, markRead, markAllRead, registerDevice } = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getMyNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.post('/register-device', registerDevice);

module.exports = router;
