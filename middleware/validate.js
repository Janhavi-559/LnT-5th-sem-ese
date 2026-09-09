const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * Request validation middleware wrapper
 * Checks validationResult from express-validator chains
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Execute all validation chains
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    return next(
      new ApiError(
        'Validation failed: please verify all required fields and formats.',
        400,
        'VALIDATION_ERROR',
        extractedErrors
      )
    );
  };
};

module.exports = validate;
