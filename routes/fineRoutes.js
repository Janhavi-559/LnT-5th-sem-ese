const express = require('express');
const { body } = require('express-validator');
const {
  payFine,
  waiveFine,
  getMyFines,
  getAllUnpaidFines
} = require('../controllers/fineController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();

const paymentValidation = [
  body('transactionId').isMongoId().withMessage('Valid Transaction ID is required'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('paymentMethod').optional().isIn(['CASH', 'UPI', 'CARD', 'ONLINE_MOCK']).withMessage('Valid payment method required')
];

router.post('/pay', protect, validate(paymentValidation), payFine);
router.get('/my-fines', protect, getMyFines);

// Staff management
router.get('/unpaid', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getAllUnpaidFines);
router.put('/:transactionId/waive', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), waiveFine);

module.exports = router;
