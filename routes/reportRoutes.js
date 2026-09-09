const express = require('express');
const {
  getMostBorrowedBooks,
  getOverdueSummaryReport,
  getInventoryHealthReport,
  getFinancialReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/most-borrowed', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getMostBorrowedBooks);
router.get('/overdue-summary', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getOverdueSummaryReport);
router.get('/inventory-health', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getInventoryHealthReport);
router.get('/financials', protect, authorize(ROLES.ADMIN), getFinancialReport);

module.exports = router;
