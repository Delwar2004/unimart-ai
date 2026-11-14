import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { getUnreadNotificationCount } from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const isValidObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const parsePagination = (query) => {
  const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
  const limitValue = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const page = Math.max(1, parseInt(pageValue, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitValue, 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * @route   GET /api/v1/notifications
 * @desc    List the current user's notifications, newest first
 * @access  Private
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { recipient: req.user._id };

    const total = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return successResponse(res, {
      statusCode: 200,
      message: 'Notifications retrieved successfully.',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Unread notification count for the current user
 * @access  Private
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await getUnreadNotificationCount(req.user._id);
    return successResponse(res, {
      statusCode: 200,
      message: 'Unread notification count retrieved.',
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark one of the current user's notifications as read
 * @access  Private
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid notification ID format.',
      });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Notification not found.',
      });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You are not allowed to modify this notification.',
      });
    }

    notification.isRead = true;
    await notification.save();

    return successResponse(res, {
      statusCode: 200,
      message: 'Notification marked as read.',
      data: {
        id: notification._id,
        isRead: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark every notification belonging to the current user as read
 * @access  Private
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return successResponse(res, {
      statusCode: 200,
      message: 'All notifications marked as read.',
      data: {
        updatedCount: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete one of the current user's notifications
 * @access  Private
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid notification ID format.',
      });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Notification not found.',
      });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You are not allowed to delete this notification.',
      });
    }

    await notification.deleteOne();

    return successResponse(res, {
      statusCode: 200,
      message: 'Notification deleted.',
      data: { id: notification._id },
    });
  } catch (error) {
    next(error);
  }
};
