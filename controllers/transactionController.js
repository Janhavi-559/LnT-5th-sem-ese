const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const User = require('../models/User');
const Hold = require('../models/Hold');
const ApiError = require('../utils/apiError');
const {
  TRANSACTION_STATUS,
  FINE_STATUS,
  HOLD_STATUS,
  DEFAULT_PLANS,
  MEMBER_TYPES
} = require('../config/constants');

/**
 * @desc   Issue a book to a member (Module 4: Book Issue Workflow)
 * @route  POST /api/transactions/issue
 * @access Librarian, Admin
 */
const issueBook = async (req, res, next) => {
  try {
    const { bookId, memberId, remarks } = req.body;

    // 1. Verify Member
    const member = await User.findById(memberId);
    if (!member) {
      throw new ApiError('Member record not found', 404, 'MEMBER_NOT_FOUND');
    }
    if (!member.isActive) {
      throw new ApiError('Member account is inactive/deactivated', 400, 'INACTIVE_MEMBER');
    }

    // 2. Check Member Borrow Limit
    const activeBorrows = await Transaction.countDocuments({
      memberId: member._id,
      status: TRANSACTION_STATUS.ISSUED
    });

    const maxAllowed = member.maxBooksAllowed || DEFAULT_PLANS[member.memberType]?.maxBooksAllowed || 3;
    if (activeBorrows >= maxAllowed) {
      throw new ApiError(
        `Borrowing limit exceeded: ${member.memberType.toUpperCase()} accounts are allowed a maximum of ${maxAllowed} simultaneous books. Currently active: ${activeBorrows}.`,
        400,
        'BORROW_LIMIT_EXCEEDED'
      );
    }

    // 3. Verify Book and Availability
    const book = await Book.findById(bookId);
    if (!book) {
      throw new ApiError('Book record not found', 404, 'BOOK_NOT_FOUND');
    }

    if (book.availableCopies <= 0) {
      throw new ApiError(
        `No available copies for '${book.title}'. Total: ${book.totalCopies}, Available: 0. Member can place a hold request instead.`,
        400,
        'BOOK_OUT_OF_STOCK'
      );
    }

    // 4. Check Hold Queue Priority
    // If holds exist, ensure this member is either the oldest hold or no one else is in line
    const pendingHolds = await Hold.find({
      bookId: book._id,
      status: { $in: [HOLD_STATUS.QUEUED, HOLD_STATUS.AVAILABLE_FOR_PICKUP] }
    }).sort({ requestedAt: 1 });

    if (pendingHolds.length > 0) {
      const topHold = pendingHolds[0];
      const isTopHoldMember = topHold.memberId.toString() === member._id.toString();

      // If available copies are only enough to satisfy pending holds and user isn't top hold
      if (book.availableCopies <= pendingHolds.length && !isTopHoldMember) {
        throw new ApiError(
          'This book is currently reserved for a member in the hold queue.',
          409,
          'HOLD_QUEUE_PRIORITY_CONFLICT'
        );
      }

      // If user had the top hold, fulfill it
      if (isTopHoldMember) {
        topHold.status = HOLD_STATUS.FULFILLED;
        await topHold.save();
      }
    }

    // 5. Calculate Due Date based on member plan
    const loanDays = member.loanPeriodDays || DEFAULT_PLANS[member.memberType]?.loanPeriodDays || 14;
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + loanDays * 24 * 60 * 60 * 1000);

    // 6. Atomically Decrement Available Copies
    book.availableCopies -= 1;
    await book.save();

    // 7. Create Transaction Record
    const transaction = await Transaction.create({
      bookId: book._id,
      memberId: member._id,
      issueDate,
      dueDate,
      status: TRANSACTION_STATUS.ISSUED,
      fineAmount: 0,
      fineStatus: FINE_STATUS.NONE,
      remarks: remarks || `Issued by ${req.user.name}`,
      issuedBy: req.user._id
    });

    const populatedTx = await Transaction.findById(transaction._id)
      .populate('bookId', 'title author isbn category rackNumber')
      .populate('memberId', 'name email membershipId memberType');

    res.status(201).json({
      success: true,
      message: 'Book successfully issued to member',
      data: populatedTx
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Process book return and compute overdue fine (Module 5: Book Return & Fine Calculation)
 * @route  PUT /api/transactions/:id/return
 * @access Librarian, Admin
 */
const returnBook = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('memberId', 'name email memberType membershipId')
      .populate('bookId', 'title author totalCopies availableCopies');

    if (!transaction) {
      throw new ApiError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status === TRANSACTION_STATUS.RETURNED) {
      throw new ApiError('This book has already been recorded as returned', 400, 'ALREADY_RETURNED');
    }

    const returnDate = new Date();
    const dueDate = new Date(transaction.dueDate);

    // Compute overdue days
    const diffTime = returnDate.getTime() - dueDate.getTime();
    const overdueDays = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    // Compute fine rate based on memberType
    const memberType = transaction.memberId?.memberType || MEMBER_TYPES.STUDENT;
    const fineRate = DEFAULT_PLANS[memberType]?.fineRatePerDay || 10;
    const computedFine = overdueDays * fineRate;

    transaction.returnDate = returnDate;
    transaction.status = TRANSACTION_STATUS.RETURNED;
    transaction.returnedTo = req.user._id;

    if (computedFine > 0) {
      transaction.fineAmount = computedFine;
      transaction.fineStatus = FINE_STATUS.UNPAID;
      transaction.remarks = (transaction.remarks || '') + ` | Overdue by ${overdueDays} day(s). Fine: ₹${computedFine}`;
    } else {
      transaction.fineAmount = 0;
      transaction.fineStatus = FINE_STATUS.NONE;
    }

    await transaction.save();

    // Increment available book copies
    const book = await Book.findById(transaction.bookId._id);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      await book.save();

      // Check hold queue: promote oldest waiting hold
      const nextHold = await Hold.findOne({
        bookId: book._id,
        status: HOLD_STATUS.QUEUED
      }).sort({ requestedAt: 1 });

      if (nextHold) {
        nextHold.status = HOLD_STATUS.AVAILABLE_FOR_PICKUP;
        nextHold.notifiedAt = new Date();
        // 3 days pickup window
        nextHold.pickupExpiryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await nextHold.save();
      }
    }

    res.status(200).json({
      success: true,
      message: overdueDays > 0
        ? `Book returned. Overdue by ${overdueDays} day(s). Fine of ₹${computedFine} recorded.`
        : 'Book returned successfully on time. No fines applied.',
      data: {
        transactionId: transaction._id,
        bookTitle: transaction.bookId?.title,
        memberName: transaction.memberId?.name,
        returnDate,
        dueDate,
        overdueDays,
        fineRatePerDay: fineRate,
        fineAmount: transaction.fineAmount,
        fineStatus: transaction.fineStatus
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Report a borrowed book as lost or severely damaged (Module 10: Inventory & Copy Management)
 * @route  POST /api/transactions/:id/report-lost
 * @access Librarian, Admin
 */
const reportLostOrDamaged = async (req, res, next) => {
  try {
    const { issueType = 'LOST', notes } = req.body;
    const transaction = await Transaction.findById(req.params.id)
      .populate('bookId')
      .populate('memberId');

    if (!transaction) {
      throw new ApiError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== TRANSACTION_STATUS.ISSUED) {
      throw new ApiError('Only active issued books can be marked as lost or damaged', 400, 'INVALID_TX_STATUS');
    }

    const book = await Book.findById(transaction.bookId._id);
    const replacementCost = book.price || 500;

    if (issueType === 'LOST') {
      book.lostCopies += 1;
      book.totalCopies = Math.max(0, book.totalCopies - 1);
      transaction.status = TRANSACTION_STATUS.LOST;
      transaction.fineAmount = replacementCost;
      transaction.fineStatus = FINE_STATUS.UNPAID;
      transaction.remarks = `Copy reported LOST. Replacement fine charged: ₹${replacementCost}. ${notes || ''}`;
    } else {
      book.damagedCopies += 1;
      const damageFee = Math.round(replacementCost * 0.5);
      transaction.fineAmount = damageFee;
      transaction.fineStatus = FINE_STATUS.UNPAID;
      transaction.remarks = `Copy reported DAMAGED. Repair fee charged: ₹${damageFee}. ${notes || ''}`;
    }

    await book.save();
    await transaction.save();

    res.status(200).json({
      success: true,
      message: `Transaction updated. ${issueType} penalty applied: ₹${transaction.fineAmount}.`,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get borrowing history of currently authenticated member (Module 11: Member Borrowing History)
 * @route  GET /api/transactions/my-history
 * @access Member
 */
const getMyBorrowingHistory = async (req, res, next) => {
  try {
    const history = await Transaction.find({ memberId: req.user._id })
      .populate('bookId', 'title author isbn category rackNumber')
      .sort({ createdAt: -1 });

    const activeBorrows = history.filter((t) => t.status === TRANSACTION_STATUS.ISSUED);
    const completedBorrows = history.filter((t) => t.status === TRANSACTION_STATUS.RETURNED);
    const unpaidFines = history
      .filter((t) => t.fineStatus === FINE_STATUS.UNPAID)
      .reduce((sum, t) => sum + (t.fineAmount || 0), 0);

    res.status(200).json({
      success: true,
      count: history.length,
      summary: {
        totalBorrowCount: history.length,
        activeBorrowsCount: activeBorrows.length,
        completedBorrowsCount: completedBorrows.length,
        totalUnpaidFines: unpaidFines
      },
      data: history
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get borrowing history of any specific member (Module 11: Member Borrowing History)
 * @route  GET /api/transactions/member/:memberId
 * @access Librarian, Admin
 */
const getMemberBorrowingHistory = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const member = await User.findById(memberId);
    if (!member) {
      throw new ApiError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    const history = await Transaction.find({ memberId })
      .populate('bookId', 'title author isbn category rackNumber')
      .populate('issuedBy', 'name email')
      .populate('returnedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      member: {
        name: member.name,
        email: member.email,
        membershipId: member.membershipId,
        memberType: member.memberType
      },
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get all active issues (for librarian desk)
 * @route  GET /api/transactions/active
 * @access Librarian, Admin
 */
const getActiveTransactions = async (req, res, next) => {
  try {
    const active = await Transaction.find({ status: TRANSACTION_STATUS.ISSUED })
      .populate('bookId', 'title author isbn category')
      .populate('memberId', 'name email membershipId memberType')
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: active.length,
      data: active
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  issueBook,
  returnBook,
  reportLostOrDamaged,
  getMyBorrowingHistory,
  getMemberBorrowingHistory,
  getActiveTransactions
};
