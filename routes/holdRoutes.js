const express = require('express');
const { body } = require('express-validator');
const {
  placeHold,
  cancelHold,
  getBookHoldQueue,
  getMyHolds
} = require('../controllers/holdController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const holdValidation = [
  body('bookId').isMongoId().withMessage('Valid Book ID is required')
];

router.post('/', protect, validate(holdValidation), placeHold);
router.delete('/:id', protect, cancelHold);
router.get('/my-holds', protect, getMyHolds);
router.get('/book/:bookId', protect, getBookHoldQueue);

module.exports = router;
