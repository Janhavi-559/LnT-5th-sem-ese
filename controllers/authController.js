const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Hold = require('../models/Hold');
const ApiError = require('../utils/apiError');
const { generateMembershipId } = require('../utils/membershipIdGenerator');
const { ROLES, TRANSACTION_STATUS, HOLD_STATUS } = require('../config/constants');

// Helper to sign JWT token
const signToken = (id, role) => {
  const secret = process.env.JWT_SECRET || 'super_secret_university_lms_jwt_token_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id, role }, secret, { expiresIn });
};

/**
 * @desc   Register a new library member
 * @route  POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, memberType, phone, department } = req.body;

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError('Email address is already registered', 409, 'EMAIL_EXISTS');
    }

    // Generate university membership ID
    const membershipId = await generateMembershipId();

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      membershipId,
      role: ROLES.MEMBER,
      memberType: memberType || 'student',
      phone,
      department
    });

    const token = signToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        user,
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Login user & obtain JWT token
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new ApiError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new ApiError('Account has been deactivated. Please contact the administrator.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get currently authenticated user's profile and active borrow summary
 * @route  GET /api/auth/profile
 * @access Private
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Fetch active borrow counts and active holds
    const activeBorrowsCount = await Transaction.countDocuments({
      memberId: req.user._id,
      status: TRANSACTION_STATUS.ISSUED
    });

    const activeHoldsCount = await Hold.countDocuments({
      memberId: req.user._id,
      status: { $in: [HOLD_STATUS.QUEUED, HOLD_STATUS.AVAILABLE_FOR_PICKUP] }
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          activeBorrows: activeBorrowsCount,
          activeHolds: activeHoldsCount,
          maxBooksAllowed: user.maxBooksAllowed,
          remainingBorrowQuota: Math.max(0, user.maxBooksAllowed - activeBorrowsCount)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Update user profile details
 * @route  PUT /api/auth/profile
 * @access Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, department } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(department && { department })
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};
