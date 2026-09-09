const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

/**
 * JWT Authentication Middleware
 * Validates the Bearer token in the Authorization header
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError('Not authorized to access this route. Token missing.', 401, 'AUTH_REQUIRED'));
  }

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_university_lms_jwt_token_key_2026';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError('User belonging to this token no longer exists.', 401, 'USER_NOT_FOUND'));
    }

    if (!user.isActive) {
      return next(new ApiError('Your account has been deactivated. Please contact the administrator.', 403, 'ACCOUNT_DEACTIVATED'));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError('Session has expired. Please log in again.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new ApiError('Invalid authentication token.', 401, 'INVALID_TOKEN'));
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} roles Allowed roles ('admin', 'librarian', 'member')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError('User identity could not be verified.', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Access forbidden: User role '${req.user.role}' is not authorized to access this endpoint.`,
          403,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};
