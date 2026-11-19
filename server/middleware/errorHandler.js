const { ErrorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }

  // Upload limits (file too large, too many files) are the uploader's mistake, not a server error
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large.' : err.code === 'LIMIT_FILE_COUNT' ? 'Too many files.' : err.message;
    error = new ErrorResponse(message, 400);
  }

  // e.g. a missing file under /uploads
  if (!error.statusCode && err.status >= 400 && err.status < 500) error.statusCode = err.status;

  const statusCode = error.statusCode || 500;
  const responseData = {
    success: false,
    message: error.message || 'Server Error'
  };

  if (error.errors) {
    responseData.errors = error.errors;
  }

  res.status(statusCode).json(responseData);
};

module.exports = errorHandler;
