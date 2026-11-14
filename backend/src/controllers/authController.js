import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { USER_ROLES, ACCOUNT_STATUS } from '../constants/index.js';
import { isPasswordStrong, isValidUniversityEmail } from '../utils/validators.js';
import { generateToken } from '../utils/token.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new student with university email verification token
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, studentId, department, batch, phone, campusLocation } = req.body;

    // 1. Validate required fields
    if (
      !name ||
      !email ||
      !password ||
      !campusLocation ||
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof campusLocation !== 'string'
    ) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide all required fields as valid strings (name, email, password, campusLocation).',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Validate university email domain
    if (!isValidUniversityEmail(trimmedEmail)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Registration requires a valid university email address corresponding to permitted university domains.',
      });
    }

    // 3. Validate password strength
    if (!isPasswordStrong(password)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.',
      });
    }

    // 4. Check for duplicate email
    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'An account with this university email already exists.',
      });
    }

    // 5. Check for duplicate student ID (if provided)
    if (studentId && studentId.trim()) {
      const existingStudentId = await User.findOne({ studentId: studentId.trim() });
      if (existingStudentId) {
        return errorResponse(res, {
          statusCode: 409,
          message: 'An account with this student ID already exists.',
        });
      }
    }

    // 6. Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 7. Generate cryptographically secure verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 8. Create user record (role strictly forced to student)
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      passwordHash,
      studentId: studentId ? studentId.trim() : undefined,
      department: department ? department.trim() : undefined,
      batch: batch ? batch.trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      campusLocation: campusLocation.trim(),
      role: USER_ROLES.STUDENT,
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      status: ACCOUNT_STATUS.ACTIVE,
    });

    // 9. Send verification email
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
    });

    // 10. Return success response (sensitive fields omitted)
    return successResponse(res, {
      statusCode: 201,
      message: 'Registration successful! A verification link has been sent to your university email.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        department: user.department,
        batch: user.batch,
        campusLocation: user.campusLocation,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify student account using email token
 * @access  Public
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Verification token is required.',
      });
    }

    // Find user with active matching verification token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    }).select('+verificationToken +verificationTokenExpires');

    if (!user) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid or expired email verification token. Please request a new verification link.',
      });
    }

    // Activate and clear token
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: 'Your university email has been verified successfully. You can now log in to UniMart AI.',
      data: {
        id: user._id,
        email: user.email,
        isVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      !password ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide both valid email and password strings.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Query user including passwordHash
    const user = await User.findOne({ email: trimmedEmail }).select('+passwordHash');

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password credentials.',
      });
    }

    // Compare password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password credentials.',
      });
    }

    // Check account status
    if (user.status === ACCOUNT_STATUS.BANNED) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account has been permanently banned from the marketplace.',
      });
    }

    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account is currently suspended. Please contact marketplace administration.',
      });
    }

    // Check email verification status
    if (!user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your university email address has not been verified yet. Please check your inbox for the verification link.',
      });
    }

    // Issue JWT
    const token = generateToken(user._id, user.role);

    return successResponse(res, {
      statusCode: 200,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          department: user.department,
          batch: user.batch,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isVerified: user.isVerified,
          status: user.status,
          campusLocation: user.campusLocation,
          reputation: user.reputation,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get currently authenticated user profile
 * @access  Private (Requires JWT)
 */
export const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    return successResponse(res, {
      statusCode: 200,
      message: 'User profile retrieved successfully.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        department: user.department,
        batch: user.batch,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        campusLocation: user.campusLocation,
        reputation: user.reputation,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide a valid account email string.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    // Consistent response whether user exists or not to prevent account enumeration
    const genericSuccessMessage = 'If an account associated with that email exists, password reset instructions have been sent.';

    if (!user) {
      return successResponse(res, {
        statusCode: 200,
        message: genericSuccessMessage,
      });
    }

    // Generate reset token (1 hour expiration)
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Store only SHA-256 hash in database to prevent token exposure in database dumps
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: resetToken,
    });

    return successResponse(res, {
      statusCode: 200,
      message: genericSuccessMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password using reset token
 * @access  Public
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || typeof token !== 'string') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Valid password reset token string is required.',
      });
    }

    if (!password || typeof password !== 'string') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide a valid new password string.',
      });
    }

    if (!isPasswordStrong(password)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.',
      });
    }

    // Hash incoming token to match stored hash (with fallback to plaintext for seamless migration)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching, non-expired token
    const user = await User.findOne({
      $or: [{ resetPasswordToken: hashedToken }, { resetPasswordToken: token }],
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid or expired password reset token. Please request a new reset link.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(password, salt);

    // Invalidate reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};
