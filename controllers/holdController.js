const Hold = require('../models/Hold');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/apiError');
const { HOLD_STATUS, TRANSACTION_STATUS, ROLES } = require('../config/constants');

/**
 * @desc   Place a hold reservation on a book (Module 6: Reservation/Hold Queue)
 * @route  POST /api/holds
 * @access Member, Librarian, Admin
 */
const placeHold = async (req, res, next) => {
  try {
    const { bookId } = req.body;
    // Target member is either specified by librarian or self for member
    const memberId = req.user.role === ROLES.MEMBER ? req.user._id : (req.body.memberId || req.user._id);

    const book = await Book.findById(bookId);
    if (!book) {
      throw new ApiError('Book not found in catalog', 404, 'BOOK_NOT_FOUND');
    }

    // Check if copies are actually unavailable (business rule: holds are for unavailable books)
    if (book.availableCopies > 0) {
      throw new ApiError(
        `Copies of '${book.title}' are currently available on the shelf (${book.availableCopies} available). Please issue directly instead of placing a hold.`,
        400,
        'COPIES_AVAILABLE_FOR_ISSUE'
      );
    }

    // Check if member already has this book borrowed
    const alreadyBorrowed = await Transaction.findOne({
      bookId: book._id,
      memberId,
      status: TRANSACTION_STATUS.ISSUED
    });
    if (alreadyBorrowed) {
      throw new ApiError('You currently have an active borrowed copy of this book.', 400, 'ALREADY_BORROWED');
    }

    // Check if member already has an active hold
    const existingHold = await Hold.findOne({
      bookId: book._id,
      memberId,
      status: { $in: [HOLD_STATUS.QUEUED, HOLD_STATUS.AVAILABLE_FOR_PICKUP] }
    });
    if (existingHold) {
      throw new ApiError('You already have an active hold reservation on this book.', 409, 'DUPLICATE_HOLD');
    }

    const hold = await Hold.create({
      bookId: book._id,
      memberId,
      requestedAt: new Date(),
      status: HOLD_STATUS.QUEUED
    });

    // Calculate queue position
    const queuePosition = await Hold.countDocuments({
      bookId: book._id,
      status: HOLD_STATUS.QUEUED,
      requestedAt: { $lte: hold.requestedAt }
    });

    res.status(201).json({
      success: true,
      message: `Hold placed successfully. You are #${queuePosition} in the reservation queue.`,
      data: {
        holdId: hold._id,
        bookTitle: book.title,
        queuePosition,
        status: hold.status,
        requestedAt: hold.requestedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Cancel a hold reservation
 * @route  DELETE /api/holds/:id
 * @access Member (own hold) / Librarian / Admin
 */
const cancelHold = async (req, res, next) => {
  try {
    const hold = await Hold.findById(req.params.id);
    if (!hold) {
      throw new ApiError('Hold reservation record not found', 404, 'HOLD_NOT_FOUND');
    }

    // Authorization check
    if (req.user.role === ROLES.MEMBER && hold.memberId.toString() !== req.user._id.toString()) {
      throw new ApiError('Not authorized to cancel this hold reservation', 403, 'FORBIDDEN');
    }

    hold.status = HOLD_STATUS.CANCELLED;
    await hold.save();

    res.status(200).json({
      success: true,
      message: 'Hold reservation successfully cancelled'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get hold queue for a specific book
 * @route  GET /api/holds/book/:bookId
 * @access Authenticated
 */
const getBookHoldQueue = async (req, res, next) => {
  try {
    const holds = await Hold.find({
      bookId: req.params.bookId,
      status: { $in: [HOLD_STATUS.QUEUED, HOLD_STATUS.AVAILABLE_FOR_PICKUP] }
    })
      .populate('memberId', 'name email membershipId')
      .sort({ requestedAt: 1 });

    res.status(200).json({
      success: true,
      count: holds.length,
      data: holds
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get authenticated member's hold reservations
 * @route  GET /api/holds/my-holds
 * @access Member
 */
const getMyHolds = async (req, res, next) => {
  try {
    const holds = await Hold.find({ memberId: req.user._id })
      .populate('bookId', 'title author isbn category availableCopies')
      .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      count: holds.length,
      data: holds
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  placeHold,
  cancelHold,
  getBookHoldQueue,
  getMyHolds
};
