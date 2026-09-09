const express = require('express');
const { body } = require('express-validator');
const {
  issueBook,
  returnBook,
  reportLostOrDamaged,
  getMyBorrowingHistory,
  getMemberBorrowingHistory,
  getActiveTransactions
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();

const issueValidation = [
  body('bookId').isMongoId().withMessage('Valid Book ID is required'),
  body('memberId').isMongoId().withMessage('Valid Member ID is required')
];

// Member routes
router.get('/my-history', protect, getMyBorrowingHistory);

// Librarian/Admin routes
router.get('/active', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getActiveTransactions);
router.get('/member/:memberId', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getMemberBorrowingHistory);

router.post(
  '/issue',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  validate(issueValidation),
  issueBook
);

router.put(
  '/:id/return',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  returnBook
);

router.post(
  '/:id/report-lost',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  reportLostOrDamaged
);

module.exports = router;
