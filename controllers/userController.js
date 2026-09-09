const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateMembershipId } = require('../utils/membershipIdGenerator');
const { ROLES, MEMBER_TYPES, DEFAULT_PLANS } = require('../config/constants');

/**
 * @desc   Create a librarian account (Admin only)
 * @route  POST /api/users/librarian
 * @access Admin
 */
const createLibrarian = async (req, res, next) => {
  try {
    const { name, email, password, phone, department } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError('Email is already registered in the system', 409, 'EMAIL_EXISTS');
    }

    const membershipId = await generateMembershipId();

    const librarian = await User.create({
      name,
      email,
      passwordHash: password,
      membershipId,
      role: ROLES.LIBRARIAN,
      phone,
      department: department || 'Library Administration'
    });

    res.status(201).json({
      success: true,
      message: 'Librarian account created successfully',
      data: librarian
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get list of all users with role filtering and pagination
 * @route  GET /api/users
 * @access Librarian, Admin
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, memberType, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (memberType) filter.memberType = memberType;

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { membershipId: regex }];
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
        limit: parsedLimit
      },
      data: users
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get predefined membership plan tiers & rules (Module 7: Membership Plans & Limits)
 * @route  GET /api/users/plans
 * @access Public / Authenticated
 */
const getMembershipPlans = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Library membership plans and loan limits',
      data: DEFAULT_PLANS
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Update a member's loan plan limits or status (Module 7: Plans & Limits)
 * @route  PUT /api/users/:id/plan
 * @access Admin
 */
const updateMemberPlan = async (req, res, next) => {
  try {
    const { memberType, maxBooksAllowed, loanPeriodDays } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (memberType) {
      user.memberType = memberType;
      // Auto-assign default limits for the new member type unless custom ones are supplied
      if (!maxBooksAllowed) user.maxBooksAllowed = DEFAULT_PLANS[memberType]?.maxBooksAllowed;
      if (!loanPeriodDays) user.loanPeriodDays = DEFAULT_PLANS[memberType]?.loanPeriodDays;
    }

    if (maxBooksAllowed !== undefined) {
      user.maxBooksAllowed = parseInt(maxBooksAllowed, 10);
    }
    if (loanPeriodDays !== undefined) {
      user.loanPeriodDays = parseInt(loanPeriodDays, 10);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Member plan limits updated successfully',
      data: user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Activate or Deactivate a user account
 * @route  PATCH /api/users/:id/status
 * @access Admin
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User account has been ${user.isActive ? 'activated' : 'deactivated'}`,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createLibrarian,
  getAllUsers,
  getMembershipPlans,
  updateMemberPlan,
  toggleUserStatus
};
