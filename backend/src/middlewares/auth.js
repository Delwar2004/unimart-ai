import { User } from '../models/User.js';
import { verifyToken } from '../utils/token.js';
import { errorResponse } from '../utils/response.js';
import { ACCOUNT_STATUS } from '../constants/index.js';

/**
 * Protect routes: verifies JWT and loads active user into req.user
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Not authorized. No authentication token provided.',
    });
  }

  try {
    const decoded = verifyToken(token);

    // Fetch user from DB to verify validity and latest status
    const user = await User.findById(decoded.userId);

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Check account status
    if (user.status === ACCOUNT_STATUS.BANNED) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account has been banned. Access to marketplace features is prohibited.',
      });
    }

    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account is currently suspended. Please contact administrator.',
      });
    }

    // Attach verified user instance to request object
    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Not authorized. Invalid or expired authentication token.',
    });
  }
};

/**
 * Role-based authorization middleware factory
 * @param  {...string} roles Allowed roles (e.g. 'admin', 'student')
 */
/**
 * Attach req.user when a bearer token is present. Public routes stay open without one.
 */
export const optionalProtect = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }
  return protect(req, res, next);
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(res, {
        statusCode: 403,
        message: `User role '${req.user?.role || 'anonymous'}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};
