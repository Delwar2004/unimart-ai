import { errorResponse } from '../utils/response.js';

/**
 * 404 Not Found Middleware for unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
  return errorResponse(res, {
    statusCode: 404,
    message: `Resource not found at ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized Global Error Handler Middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${err.stack || err.message}`);

  // Mongoose Bad ObjectId / Cast Error
  if (err.name === 'CastError') {
    return errorResponse(res, {
      statusCode: 400,
      message: `Invalid identifier format: ${err.value}`,
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return errorResponse(res, {
      statusCode: 400,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(res, {
      statusCode: 409,
      message: `Duplicate field value entered for '${field}'. Please provide a unique value.`,
    });
  }

  // Multer File Upload Errors
  if (err.name === 'MulterError') {
    return errorResponse(res, {
      statusCode: 400,
      message: `File upload error: ${err.message}`,
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(res, {
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { errors: err.stack }),
  });
};
