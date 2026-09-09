const mongoose = require('mongoose');
const { TRANSACTION_STATUS, FINE_STATUS } = require('../config/constants');

const transactionSchema = new mongoose.Schema(
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
    issueDate: {
      type: Date,
      default: Date.now
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    returnDate: {
      type: Date
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    fineStatus: {
      type: String,
      enum: Object.values(FINE_STATUS),
      default: FINE_STATUS.NONE
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.ISSUED,
      index: true
    },
    remarks: {
      type: String,
      trim: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    returnedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast lookups
transactionSchema.index({ memberId: 1, status: 1 });
transactionSchema.index({ bookId: 1, status: 1 });
transactionSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
