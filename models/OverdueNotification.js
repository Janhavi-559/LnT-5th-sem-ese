const mongoose = require('mongoose');
const { NOTIFICATION_STATUS } = require('../config/constants');

const overdueNotificationSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'Transaction reference is required'],
      index: true
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required']
    },
    daysOverdue: {
      type: Number,
      required: true,
      min: 1
    },
    accruedFine: {
      type: Number,
      required: true,
      min: 0
    },
    noticeDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.SENT
    },
    message: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

overdueNotificationSchema.index({ memberId: 1, noticeDate: -1 });

module.exports = mongoose.model('OverdueNotification', overdueNotificationSchema);
