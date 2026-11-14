import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get currently authenticated student's full profile
 * @access  Private (Requires JWT)
 */
export const getOwnProfile = async (req, res, next) => {
  try {
    const user = req.user;

    return successResponse(res, {
      statusCode: 200,
      message: 'Profile retrieved successfully.',
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
        campusLocation: user.campusLocation,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        reputation: user.reputation,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update editable profile fields for authenticated student
 * @access  Private (Requires JWT)
 */
export const updateOwnProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const { name, department, batch, phone, bio, campusLocation } = req.body;

    // Validation rules
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Name cannot be empty.',
        });
      }
      if (name.trim().length > 100) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Name cannot exceed 100 characters.',
        });
      }
      user.name = name.trim();
    }

    if (department !== undefined) {
      if (typeof department !== 'string') {
        return errorResponse(res, { statusCode: 400, message: 'Department must be a string.' });
      }
      if (department.trim().length > 100) {
        return errorResponse(res, { statusCode: 400, message: 'Department cannot exceed 100 characters.' });
      }
      user.department = department.trim();
    }

    if (batch !== undefined) {
      if (typeof batch !== 'string') {
        return errorResponse(res, { statusCode: 400, message: 'Batch must be a string.' });
      }
      if (batch.trim().length > 50) {
        return errorResponse(res, { statusCode: 400, message: 'Batch cannot exceed 50 characters.' });
      }
      user.batch = batch.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return errorResponse(res, { statusCode: 400, message: 'Phone must be a string.' });
      }
      if (phone.trim().length > 25) {
        return errorResponse(res, { statusCode: 400, message: 'Phone cannot exceed 25 characters.' });
      }
      user.phone = phone.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return errorResponse(res, { statusCode: 400, message: 'Bio must be a string.' });
      }
      if (bio.trim().length > 500) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Bio cannot exceed 500 characters.',
        });
      }
      user.bio = bio.trim();
    }

    if (campusLocation !== undefined) {
      if (typeof campusLocation !== 'string' || campusLocation.trim().length === 0) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Campus location cannot be empty.',
        });
      }
      if (campusLocation.trim().length > 150) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Campus location cannot exceed 150 characters.',
        });
      }
      user.campusLocation = campusLocation.trim();
    }

    // Save only validated changes; unauthorized fields in req.body are strictly ignored
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: 'Profile updated successfully.',
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
        campusLocation: user.campusLocation,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        reputation: user.reputation,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/users/profile/avatar
 * @desc    Upload or update avatar profile picture
 * @access  Private (Requires JWT)
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide an image file to upload.',
      });
    }

    const user = req.user;
    const oldAvatarUrl = user.avatarUrl;

    // Construct public URL relative to server root
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    user.avatarUrl = avatarPath;
    await user.save();

    // Safely cleanup obsolete avatar file if it exists and is not shared
    if (oldAvatarUrl && typeof oldAvatarUrl === 'string' && oldAvatarUrl.startsWith('/uploads/avatars/')) {
      try {
        const oldFilename = path.basename(oldAvatarUrl);
        const avatarDir = path.resolve('uploads', 'avatars');
        const targetPath = path.resolve(avatarDir, oldFilename);

        // Security check: ensure path stays strictly within avatars directory and valid name
        if (targetPath.startsWith(avatarDir) && /^[a-zA-Z0-9_\-\.]+$/.test(oldFilename)) {
          const sharedCount = await User.countDocuments({ _id: { $ne: user._id }, avatarUrl: oldAvatarUrl });
          if (sharedCount === 0) {
            fs.promises.unlink(targetPath).catch(() => {});
          }
        }
      } catch {
        // Cleanup failure should never fail the user request
      }
    }

    return successResponse(res, {
      statusCode: 200,
      message: 'Avatar uploaded and profile picture updated successfully.',
      data: {
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get safe public seller profile
 * @access  Public
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid user ID format.',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User profile not found.',
      });
    }

    // Strictly return only non-sensitive public seller marketplace data
    return successResponse(res, {
      statusCode: 200,
      message: 'Public seller profile retrieved successfully.',
      data: {
        id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        department: user.department || '',
        batch: user.batch || '',
        bio: user.bio || '',
        campusLocation: user.campusLocation || '',
        reputation: {
          averageRating: user.reputation?.averageRating || 0,
          ratingsCount: user.reputation?.ratingsCount || 0,
          successfulTransactions: user.reputation?.successfulTransactions || 0,
        },
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
