const express = require('express');
const { body } = require('express-validator');
const {
  createLibrarian,
  getAllUsers,
  getMembershipPlans,
  updateMemberPlan,
  toggleUserStatus
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();

const librarianValidation = [
  body('name').trim().notEmpty().withMessage('Librarian name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Public / Authenticated plans route (Module 7: Membership Plans & Limits)
router.get('/plans', getMembershipPlans);

// Staff access
router.get('/', protect, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), getAllUsers);

// Admin-only management routes
router.post(
  '/librarian',
  protect,
  authorize(ROLES.ADMIN),
  validate(librarianValidation),
  createLibrarian
);

router.put(
  '/:id/plan',
  protect,
  authorize(ROLES.ADMIN),
  updateMemberPlan
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.ADMIN),
  toggleUserStatus
);

module.exports = router;
