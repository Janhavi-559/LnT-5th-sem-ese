const express = require('express');
const { body } = require('express-validator');
const {
  createBook,
  getAllBooks,
  searchBooks,
  getBookById,
  updateBook,
  deleteBook,
  updateInventory
} = require('../controllers/bookController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();

const bookValidation = [
  body('title').trim().notEmpty().withMessage('Book title is required'),
  body('author').trim().notEmpty().withMessage('Author name is required'),
  body('isbn').trim().notEmpty().withMessage('ISBN is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('totalCopies').isInt({ min: 1 }).withMessage('Total copies must be an integer of at least 1')
];

// Public / Authenticated discovery routes
router.get('/', getAllBooks);
router.get('/search', searchBooks);
router.get('/:id', getBookById);

// Staff-only management routes
router.post(
  '/',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  validate(bookValidation),
  createBook
);

router.put(
  '/:id',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  updateBook
);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  deleteBook
);

router.put(
  '/:id/inventory',
  protect,
  authorize(ROLES.LIBRARIAN, ROLES.ADMIN),
  updateInventory
);

module.exports = router;
