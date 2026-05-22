const logger = require('../utils/logger');

const validate = (schema) => async (req, res, next) => {
  try {
    await schema.parseAsync(req.body);
    next();
  } catch (error) {
    logger.warn('Validation error:', error.errors);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.errors,
    });
  }
};

module.exports = validate;
