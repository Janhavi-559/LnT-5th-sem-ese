const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const User = require('../models/User');
const FinePayment = require('../models/FinePayment');
const { TRANSACTION_STATUS, FINE_STATUS } = require('../config/constants');

/**
 * @desc   Most borrowed books aggregation report (Module 12: Reports)
 * @route  GET /api/reports/most-borrowed
 * @access Librarian, Admin
 */
const getMostBorrowedBooks = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const pipeline = [
      {
        $group: {
          _id: '$bookId',
          borrowCount: { $sum: 1 }
        }
      },
      { $sort: { borrowCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $project: {
          _id: '$book._id',
          title: '$book.title',
          author: '$book.author',
          category: '$book.category',
          isbn: '$book.isbn',
          totalCopies: '$book.totalCopies',
          availableCopies: '$book.availableCopies',
          borrowCount: 1
        }
      }
    ];

    const results = await Transaction.aggregate(pipeline);

    res.status(200).json({
      success: true,
      reportName: 'Most Borrowed Books',
      count: results.length,
      data: results
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Overdue summary & risk analysis report
 * @route  GET /api/reports/overdue-summary
 * @access Librarian, Admin
 */
const getOverdueSummaryReport = async (req, res, next) => {
  try {
    const now = new Date();

    const overdueTransactions = await Transaction.find({
      status: TRANSACTION_STATUS.ISSUED,
      dueDate: { $lt: now }
    })
      .populate('memberId', 'name email membershipId department memberType phone')
      .populate('bookId', 'title author isbn rackNumber')
      .sort({ dueDate: 1 });

    const totalOverdueItems = overdueTransactions.length;
    let totalEstimatedFines = 0;

    const detailedList = overdueTransactions.map((tx) => {
      const diff = now.getTime() - new Date(tx.dueDate).getTime();
      const daysOverdue = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const fine = daysOverdue * (tx.memberId?.memberType === 'faculty' ? 5 : 10);
      totalEstimatedFines += fine;

      return {
        transactionId: tx._id,
        member: tx.memberId,
        book: tx.bookId,
        issueDate: tx.issueDate,
        dueDate: tx.dueDate,
        daysOverdue,
        accruedFine: fine
      };
    });

    res.status(200).json({
      success: true,
      reportName: 'Overdue Summary & Delinquency Report',
      summary: {
        totalOverdueItems,
        totalEstimatedFines
      },
      data: detailedList
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Inventory Health & Collection Breakdown Report
 * @route  GET /api/reports/inventory-health
 * @access Librarian, Admin
 */
const getInventoryHealthReport = async (req, res, next) => {
  try {
    const totalTitles = await Book.countDocuments();

    // Aggregated copy counts
    const copyTotals = await Book.aggregate([
      {
        $group: {
          _id: null,
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' },
          lostCopies: { $sum: '$lostCopies' },
          damagedCopies: { $sum: '$damagedCopies' }
        }
      }
    ]);

    // Category distribution
    const categoryDistribution = await Book.aggregate([
      {
        $group: {
          _id: '$category',
          titlesCount: { $sum: 1 },
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' }
        }
      },
      { $sort: { totalCopies: -1 } }
    ]);

    const stats = copyTotals[0] || {
      totalCopies: 0,
      availableCopies: 0,
      lostCopies: 0,
      damagedCopies: 0
    };

    const issuedCopies = Math.max(0, stats.totalCopies - stats.availableCopies - stats.lostCopies);

    res.status(200).json({
      success: true,
      reportName: 'Inventory Health & Distribution',
      data: {
        totalTitles,
        totalCopies: stats.totalCopies,
        availableCopies: stats.availableCopies,
        issuedCopies,
        lostCopies: stats.lostCopies,
        damagedCopies: stats.damagedCopies,
        utilizationRate: stats.totalCopies > 0 ? ((issuedCopies / stats.totalCopies) * 100).toFixed(1) + '%' : '0%',
        categoryDistribution
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Financial and Fine Revenue Summary
 * @route  GET /api/reports/financials
 * @access Admin
 */
const getFinancialReport = async (req, res, next) => {
  try {
    // Total fine payments collected
    const paymentAggregation = await FinePayment.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const totalCollected = paymentAggregation.reduce((acc, curr) => acc + curr.totalAmount, 0);

    // Outstanding unpaid fines
    const unpaidAggregation = await Transaction.aggregate([
      { $match: { fineStatus: FINE_STATUS.UNPAID } },
      {
        $group: {
          _id: null,
          totalUnpaid: { $sum: '$fineAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Waived fines
    const waivedCount = await Transaction.countDocuments({ fineStatus: FINE_STATUS.WAIVED });

    res.status(200).json({
      success: true,
      reportName: 'Financial & Fine Collections Report',
      data: {
        totalCollected,
        paymentBreakdownByMethod: paymentAggregation,
        outstandingUnpaidFines: unpaidAggregation[0]?.totalUnpaid || 0,
        unpaidTransactionsCount: unpaidAggregation[0]?.count || 0,
        waivedFinesCount: waivedCount
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMostBorrowedBooks,
  getOverdueSummaryReport,
  getInventoryHealthReport,
  getFinancialReport
};
