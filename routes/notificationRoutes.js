const express = require('express');
const {
  generateOverdueNotifications,
  getNotifications,
  resolveNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/', protect, getNotifications);

router.post(
  '/generate-overdue',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  generateOverdueNotifications
);

router.put(
  '/:id/resolve',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  resolveNotification
);

module.exports = router;
