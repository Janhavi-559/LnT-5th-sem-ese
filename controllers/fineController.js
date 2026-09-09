const FinePayment = require('../models/FinePayment');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/apiError');
const { FINE_STATUS, ROLES } = require('../config/constants');

/**
 * Helper to generate sequential/timestamped receipt numbers
 */
const generateReceiptNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const ts = Date.now().toString().slice(-4);
  return `REC-${year}-${rand}${ts}`;
};

/**
 * @desc   Record fine payment for a transaction (Module 8: Fine Payment Tracking)
 * @route  POST /api/fines/pay
 * @access Member, Librarian, Admin
 */
const payFine = async (req, res, next) => {
  try {
    const { transactionId, amount, paymentMethod, remarks } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('memberId', 'name email membershipId')
      .populate('bookId', 'title isbn');

    if (!transaction) {
      throw new ApiError('Transaction record not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.fineStatus !== FINE_STATUS.UNPAID || transaction.fineAmount <= 0) {
      throw new ApiError('This transaction does not have any outstanding unpaid fine', 400, 'NO_UNPAID_FINE');
    }

    const payAmount = Number(amount) || transaction.fineAmount;

    // Generate official payment receipt
    const receiptNumber = generateReceiptNumber();

    const payment = await FinePayment.create({
      transactionId: transaction._id,
      memberId: transaction.memberId._id,
      amount: payAmount,
      paymentMethod: paymentMethod || 'CASH',
      receiptNumber,
      collectedBy: req.user._id,
      remarks: remarks || `Fine paid for '${transaction.bookId?.title}'`
    });

    // Mark transaction fine as paid
    transaction.fineStatus = FINE_STATUS.PAID;
    transaction.remarks = (transaction.remarks || '') + ` | Fine paid in full: ₹${payAmount} via ${paymentMethod || 'CASH'}. Receipt: ${receiptNumber}`;
    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Fine payment recorded successfully',
      data: {
        paymentId: payment._id,
        receiptNumber,
        amount: payAmount,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        memberName: transaction.memberId?.name,
        bookTitle: transaction.bookId?.title
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Waive an outstanding fine (Librarian/Admin authority)
 * @route  PUT /api/fines/:transactionId/waive
 * @access Librarian, Admin
 */
const waiveFine = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('memberId', 'name email')
      .populate('bookId', 'title');

    if (!transaction) {
      throw new ApiError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.fineStatus !== FINE_STATUS.UNPAID) {
      throw new ApiError('Transaction has no outstanding unpaid fine to waive', 400, 'NO_UNPAID_FINE');
    }

    const waivedAmount = transaction.fineAmount;
    transaction.fineAmount = 0;
    transaction.fineStatus = FINE_STATUS.WAIVED;
    transaction.remarks = (transaction.remarks || '') + ` | Fine of ₹${waivedAmount} waived by ${req.user.name} (${req.user.role}). Reason: ${reason || 'Administrative waiver'}`;
    await transaction.save();

    res.status(200).json({
      success: true,
      message: `Fine of ₹${waivedAmount} successfully waived`,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get member's fine history and pending dues
 * @route  GET /api/fines/my-fines
 * @access Member
 */
const getMyFines = async (req, res, next) => {
  try {
    const transactionsWithFines = await Transaction.find({
      memberId: req.user._id,
      fineAmount: { $gt: 0 }
    }).populate('bookId', 'title author isbn');

    const paymentRecords = await FinePayment.find({ memberId: req.user._id })
      .populate('transactionId')
      .sort({ paidAt: -1 });

    const totalUnpaid = transactionsWithFines
      .filter((t) => t.fineStatus === FINE_STATUS.UNPAID)
      .reduce((sum, t) => sum + t.fineAmount, 0);

    const totalPaid = paymentRecords.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalUnpaid,
        totalPaid
      },
      transactionsWithFines,
      paymentRecords
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get all unpaid fines across library
 * @route  GET /api/fines/unpaid
 * @access Librarian, Admin
 */
const getAllUnpaidFines = async (req, res, next) => {
  try {
    const unpaid = await Transaction.find({ fineStatus: FINE_STATUS.UNPAID })
      .populate('memberId', 'name email membershipId phone')
      .populate('bookId', 'title author isbn')
      .sort({ dueDate: 1 });

    const totalOutstanding = unpaid.reduce((sum, t) => sum + t.fineAmount, 0);

    res.status(200).json({
      success: true,
      count: unpaid.length,
      totalOutstanding,
      data: unpaid
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  payFine,
  waiveFine,
  getMyFines,
  getAllUnpaidFines
};
