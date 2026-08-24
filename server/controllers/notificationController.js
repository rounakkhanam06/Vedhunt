const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// @desc    List my most recent notifications + unread count
// @route   GET /api/notifications
// @access  Private
exports.getMyNotifications = async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(20),
      Notification.countDocuments({ recipient: req.user._id, read: false })
    ]);
    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    next(error);
  }
};

// @desc    Mark one notification read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    logger.error('Error marking notification read:', error);
    next(error);
  }
};

// @desc    Mark all of my notifications read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error marking all notifications read:', error);
    next(error);
  }
};
