const mongoose = require('mongoose');
const { HOLD_STATUS } = require('../config/constants');

const holdSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
      index: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(HOLD_STATUS),
      default: HOLD_STATUS.QUEUED,
      index: true
    },
    pickupExpiryDate: {
      type: Date
    },
    notifiedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Unique active hold index: A member can only place one active hold per book at a time
holdSchema.index(
  { bookId: 1, memberId: 1, status: 1 }
);

module.exports = mongoose.model('Hold', holdSchema);
