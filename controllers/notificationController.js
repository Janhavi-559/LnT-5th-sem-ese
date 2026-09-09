const OverdueNotification = require('../models/OverdueNotification');
const Transaction = require('../models/Transaction');
const { TRANSACTION_STATUS, NOTIFICATION_STATUS, DEFAULT_PLANS, MEMBER_TYPES, ROLES } = require('../config/constants');
const ApiError = require('../utils/apiError');

/**
 * @desc   Scan overdue loans and generate notification records (Module 9: Overdue Notification Records)
 * @route  POST /api/notifications/generate-overdue
 * @access Librarian, Admin
 */
const generateOverdueNotifications = async (req, res, next) => {
  try {
    const now = new Date();

    // Find active issued transactions that are past due date
    const overdueTransactions = await Transaction.find({
      status: TRANSACTION_STATUS.ISSUED,
      dueDate: { $lt: now }
    })
      .populate('memberId', 'name email memberType membershipId')
      .populate('bookId', 'title isbn');

    const generatedAlerts = [];

    for (const tx of overdueTransactions) {
      const diffTime = now.getTime() - new Date(tx.dueDate).getTime();
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const memberType = tx.memberId?.memberType || MEMBER_TYPES.STUDENT;
      const fineRate = DEFAULT_PLANS[memberType]?.fineRatePerDay || 10;
      const accruedFine = daysOverdue * fineRate;

      // Check if notification already logged today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existingNotice = await OverdueNotification.findOne({
        transactionId: tx._id,
        noticeDate: { $gte: todayStart }
      });

      if (!existingNotice) {
        const message = `Dear ${tx.memberId?.name || 'Member'}, your borrowed book '${tx.bookId?.title || 'Book'}' is overdue by ${daysOverdue} day(s). Current accrued fine: ₹${accruedFine}. Please return it immediately to avoid further penalty.`;

        const notification = await OverdueNotification.create({
          memberId: tx.memberId._id,
          transactionId: tx._id,
          bookId: tx.bookId._id,
          daysOverdue,
          accruedFine,
          noticeDate: now,
          status: NOTIFICATION_STATUS.SENT,
          message
        });

        generatedAlerts.push({
          notificationId: notification._id,
          memberEmail: tx.memberId?.email,
          memberName: tx.memberId?.name,
          bookTitle: tx.bookId?.title,
          daysOverdue,
          accruedFine
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Overdue scan complete. ${generatedAlerts.length} new notification record(s) dispatched.`,
      count: generatedAlerts.length,
      data: generatedAlerts
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get overdue notifications
 * @route  GET /api/notifications
 * @access Authenticated (Members see their own, Librarians/Admins see all)
 */
const getNotifications = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === ROLES.MEMBER) {
      filter.memberId = req.user._id;
    }

    const notifications = await OverdueNotification.find(filter)
      .populate('memberId', 'name email membershipId')
      .populate('bookId', 'title author isbn')
      .sort({ noticeDate: -1 });

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Mark an overdue notification as resolved
 * @route  PUT /api/notifications/:id/resolve
 * @access Librarian, Admin
 */
const resolveNotification = async (req, res, next) => {
  try {
    const notification = await OverdueNotification.findById(req.params.id);
    if (!notification) {
      throw new ApiError('Notification record not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    notification.status = NOTIFICATION_STATUS.RESOLVED;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as resolved',
      data: notification
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateOverdueNotifications,
  getNotifications,
  resolveNotification
};
