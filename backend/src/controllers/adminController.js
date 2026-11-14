import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Review } from '../models/Review.js';
import { WantedPost } from '../models/WantedPost.js';
import { Message } from '../models/Message.js';
import {
  ACCOUNT_STATUS,
  USER_ROLES,
  MODERATION_ACTION,
  MODERATION_STATUS,
  NOTIFICATION_TYPES,
  PRODUCT_STATUS,
  REPORT_STATUS,
  REPORT_TARGET,
  REVIEW_STATUS,
  WANTED_STATUS,
} from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isValidObjectId, parsePagination } from '../utils/interest.js';
import { createNotification } from '../services/notificationService.js';
import { refreshProductRating, refreshRevieweeReputation } from '../services/reviewService.js';

const presentReport = (doc) => ({
  _id: doc._id,
  reporter: doc.reporter
    ? doc.reporter._id
      ? {
          _id: doc.reporter._id,
          name: doc.reporter.name,
          email: doc.reporter.email,
          department: doc.reporter.department || '',
          studentId: doc.reporter.studentId || '',
        }
      : doc.reporter
    : null,
  targetType: doc.targetType,
  targetId: doc.targetId,
  reason: doc.reason,
  description: doc.description || '',
  status: doc.status,
  moderator: doc.moderator
    ? doc.moderator._id
      ? {
          _id: doc.moderator._id,
          name: doc.moderator.name,
          email: doc.moderator.email,
        }
      : doc.moderator
    : null,
  moderatedAt: doc.moderatedAt || null,
  moderationAction: doc.moderationAction || '',
  moderationNote: doc.moderationNote || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const normalizeTargetType = (type) => {
  if (!type) return null;
  const cleaned = String(type).trim().toUpperCase().replace(/[-\s]/g, '_');
  if (cleaned === 'WANTEDPOST' || cleaned === 'WANTED_POST') return REPORT_TARGET.WANTED_POST;
  if (cleaned === 'PRODUCT') return REPORT_TARGET.PRODUCT;
  if (cleaned === 'USER') return REPORT_TARGET.USER;
  if (cleaned === 'REVIEW') return REPORT_TARGET.REVIEW;
  if (cleaned === 'MESSAGE') return REPORT_TARGET.MESSAGE;
  return cleaned;
};

const normalizeReportStatus = (status) => {
  if (!status) return null;
  const upper = String(status).trim().toUpperCase();
  if (Object.values(REPORT_STATUS).includes(upper)) return upper;
  return null;
};

const isObjectId = (value) => {
  if (!value) return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
};

/**
 * Safely load target details without exposing password hashes or private tokens
 */
const loadSafeTargetDetails = async (targetType, targetId) => {
  if (!isObjectId(targetId)) return { target: null, targetExists: false, authorId: null };
  const normalizedType = normalizeTargetType(targetType);

  if (normalizedType === REPORT_TARGET.PRODUCT) {
    const product = await Product.findById(targetId)
      .populate('category', 'name slug')
      .populate('seller', 'name email department batch campusLocation');
    if (!product) return { target: null, targetExists: false, authorId: null };
    return {
      target: {
        _id: product._id,
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency,
        condition: product.condition,
        listingType: product.listingType,
        status: product.status,
        moderationStatus: product.moderationStatus,
        images: product.images,
        campusLocation: product.campusLocation,
        category: product.category,
        seller: product.seller,
        createdAt: product.createdAt,
      },
      targetExists: true,
      authorId: product.seller?._id || product.seller,
    };
  }

  if (normalizedType === REPORT_TARGET.WANTED_POST) {
    const post = await WantedPost.findById(targetId)
      .populate('category', 'name slug')
      .populate('author', 'name email department batch');
    if (!post) return { target: null, targetExists: false, authorId: null };
    return {
      target: {
        _id: post._id,
        title: post.title,
        description: post.description,
        budgetMin: post.budgetMin,
        budgetMax: post.budgetMax,
        campusLocation: post.campusLocation,
        status: post.status,
        category: post.category,
        author: post.author,
        createdAt: post.createdAt,
      },
      targetExists: true,
      authorId: post.author?._id || post.author,
    };
  }

  if (normalizedType === REPORT_TARGET.REVIEW) {
    const review = await Review.findById(targetId)
      .populate('product', 'title price')
      .populate('reviewer', 'name email department')
      .populate('reviewee', 'name email department');
    if (!review) return { target: null, targetExists: false, authorId: null };
    return {
      target: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        type: review.type,
        status: review.status,
        product: review.product,
        reviewer: review.reviewer,
        reviewee: review.reviewee,
        createdAt: review.createdAt,
      },
      targetExists: true,
      authorId: review.reviewer?._id || review.reviewer,
    };
  }

  if (normalizedType === REPORT_TARGET.USER) {
    const user = await User.findById(targetId).select(
      'name email studentId department batch phone avatarUrl bio campusLocation role isVerified status reputation createdAt'
    );
    if (!user) return { target: null, targetExists: false, authorId: null };
    return {
      target: user,
      targetExists: true,
      authorId: user._id,
    };
  }

  if (normalizedType === REPORT_TARGET.MESSAGE) {
    const msg = await Message.findById(targetId)
      .populate('sender', 'name email department')
      .populate('recipient', 'name email department');
    if (!msg) return { target: null, targetExists: false, authorId: null };
    return {
      target: {
        _id: msg._id,
        text: msg.text,
        sender: msg.sender,
        recipient: msg.recipient,
        conversation: msg.conversation,
        createdAt: msg.createdAt,
      },
      targetExists: true,
      authorId: msg.sender?._id || msg.sender,
    };
  }

  return { target: null, targetExists: false, authorId: null };
};

/**
 * @route   GET /api/v1/admin/reports
 * @desc    List all reports with pagination and filtering
 * @access  Private (Admin only)
 */
export const getReports = async (req, res, next) => {
  try {
    const { status, targetType, startDate, endDate, sort } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 10);

    const filter = {};

    if (status) {
      const upperStatus = normalizeReportStatus(status);
      if (!upperStatus) {
        return errorResponse(res, { statusCode: 400, message: `Invalid status filter '${status}'.` });
      }
      filter.status = upperStatus;
    }

    if (targetType) {
      const upperType = normalizeTargetType(targetType);
      if (!upperType || !Object.values(REPORT_TARGET).includes(upperType)) {
        return errorResponse(res, { statusCode: 400, message: `Invalid targetType filter '${targetType}'.` });
      }
      filter.targetType = upperType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return errorResponse(res, { statusCode: 400, message: 'Invalid startDate format.' });
        }
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return errorResponse(res, { statusCode: 400, message: 'Invalid endDate format.' });
        }
        filter.createdAt.$lte = end;
      }
    }

    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const [reports, total, pendingCount, resolvedCount, dismissedCount] = await Promise.all([
      Report.find(filter)
        .populate('reporter', 'name email department studentId')
        .populate('moderator', 'name email')
        .sort(sortOption)
        .skip(skip)
        .limit(limit),
      Report.countDocuments(filter),
      Report.countDocuments({ status: REPORT_STATUS.PENDING }),
      Report.countDocuments({ status: REPORT_STATUS.RESOLVED }),
      Report.countDocuments({ status: REPORT_STATUS.DISMISSED }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return successResponse(res, {
      statusCode: 200,
      message: 'Admin reports retrieved successfully.',
      data: {
        reports: reports.map(presentReport),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        summary: {
          total,
          pending: pendingCount,
          resolved: resolvedCount,
          dismissed: dismissedCount,
        },
      },
      meta: {
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
 * @route   GET /api/v1/admin/reports/:id
 * @desc    Get detailed report and its associated target entity
 * @access  Private (Admin only)
 */
export const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report ID format.' });
    }

    const report = await Report.findById(id)
      .populate('reporter', 'name email department studentId')
      .populate('moderator', 'name email');

    if (!report) {
      return errorResponse(res, { statusCode: 404, message: 'Report not found.' });
    }

    const { target, targetExists, authorId } = await loadSafeTargetDetails(report.targetType, report.targetId);
    const reportData = presentReport(report);

    return successResponse(res, {
      statusCode: 200,
      message: 'Report details retrieved.',
      data: {
        ...reportData,
        report: reportData,
        target,
        targetExists,
        authorId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/reports/:id/resolve
 * @desc    Resolve a report and execute optional moderation action on target
 * @access  Private (Admin only)
 */
export const resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body || {};

    if (!isValidObjectId(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report ID format.' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return errorResponse(res, { statusCode: 404, message: 'Report not found.' });
    }

    // Prevent repeated or invalid state transitions
    if (report.status === REPORT_STATUS.RESOLVED) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'This report has already been resolved.',
      });
    }
    if (report.status === REPORT_STATUS.DISMISSED) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'This report was already dismissed and cannot be resolved.',
      });
    }

    if (action && !Object.values(MODERATION_ACTION).includes(action)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid moderation action '${action}'.`,
      });
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      return errorResponse(res, { statusCode: 400, message: 'Moderation note must be text.' });
    }
    if (note && note.length > 1000) {
      return errorResponse(res, { statusCode: 400, message: 'Moderation note cannot exceed 1000 characters.' });
    }

    const moderationAction = action || MODERATION_ACTION.NONE;
    let targetUpdated = false;

    // Validate action compatibility with target type
    if (moderationAction === MODERATION_ACTION.DEACTIVATE_PRODUCT && report.targetType !== REPORT_TARGET.PRODUCT) {
      return errorResponse(res, { statusCode: 400, message: 'Action DEACTIVATE_PRODUCT is only valid for Product reports.' });
    }
    if (moderationAction === MODERATION_ACTION.CLOSE_WANTED_POST && report.targetType !== REPORT_TARGET.WANTED_POST) {
      return errorResponse(res, { statusCode: 400, message: 'Action CLOSE_WANTED_POST is only valid for WantedPost reports.' });
    }
    if (moderationAction === MODERATION_ACTION.HIDE_REVIEW && report.targetType !== REPORT_TARGET.REVIEW) {
      return errorResponse(res, { statusCode: 400, message: 'Action HIDE_REVIEW is only valid for Review reports.' });
    }
    if ((moderationAction === MODERATION_ACTION.SUSPEND_USER || moderationAction === MODERATION_ACTION.BAN_USER) && report.targetType !== REPORT_TARGET.USER) {
      return errorResponse(res, { statusCode: 400, message: `Action ${moderationAction} is only valid for User reports.` });
    }

    // Execute target action safely
    if (moderationAction === MODERATION_ACTION.DEACTIVATE_PRODUCT) {
      const product = await Product.findById(report.targetId);
      if (product) {
        product.status = PRODUCT_STATUS.INACTIVE;
        product.moderationStatus = MODERATION_STATUS.REJECTED;
        await product.save();
        targetUpdated = true;

        await createNotification({
          recipient: product.seller,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'Listing Deactivated by Moderator',
          message: `Your listing "${product.title}" was deactivated following a content moderation review.`,
          link: `/my-listings`,
          relatedProduct: product._id,
        });
      }
    } else if (moderationAction === MODERATION_ACTION.CLOSE_WANTED_POST) {
      const post = await WantedPost.findById(report.targetId);
      if (post) {
        post.status = WANTED_STATUS.CLOSED;
        await post.save();
        targetUpdated = true;

        await createNotification({
          recipient: post.author,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'Wanted Post Closed by Moderator',
          message: `Your wanted post "${post.title}" was closed following a moderation review.`,
          link: `/wanted-posts`,
        });
      }
    } else if (moderationAction === MODERATION_ACTION.HIDE_REVIEW) {
      const review = await Review.findById(report.targetId);
      if (review) {
        review.status = REVIEW_STATUS.HIDDEN;
        await review.save();
        targetUpdated = true;

        // Recalculate ratings
        await refreshRevieweeReputation(review.reviewee);
        await refreshProductRating(review.product);

        await createNotification({
          recipient: review.reviewer,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'Review Removed by Moderator',
          message: 'Your review was hidden following a moderation review for policy compliance.',
          link: `/profile`,
        });
      }
    } else if (moderationAction === MODERATION_ACTION.SUSPEND_USER) {
      let userIdToSuspend = report.targetType === REPORT_TARGET.USER ? report.targetId : null;
      if (!userIdToSuspend) {
        const { authorId } = await loadSafeTargetDetails(report.targetType, report.targetId);
        userIdToSuspend = authorId;
      }

      if (userIdToSuspend) {
        const user = await User.findById(userIdToSuspend);
        if (user && user.role === USER_ROLES.ADMIN) {
          return errorResponse(res, { statusCode: 400, message: 'Cannot suspend an administrator account.' });
        }
        if (user) {
          user.status = ACCOUNT_STATUS.SUSPENDED;
          await user.save();
          targetUpdated = true;

          await createNotification({
            recipient: user._id,
            type: NOTIFICATION_TYPES.SYSTEM,
            title: 'Account Suspended',
            message: 'Your UniMart AI account has been temporarily suspended due to a community guidelines violation.',
            link: `/profile`,
          });
        }
      }
    } else if (moderationAction === MODERATION_ACTION.BAN_USER) {
      let userIdToBan = report.targetType === REPORT_TARGET.USER ? report.targetId : null;
      if (!userIdToBan) {
        const { authorId } = await loadSafeTargetDetails(report.targetType, report.targetId);
        userIdToBan = authorId;
      }

      if (userIdToBan) {
        const user = await User.findById(userIdToBan);
        if (user && user.role === USER_ROLES.ADMIN) {
          return errorResponse(res, { statusCode: 400, message: 'Cannot ban an administrator account.' });
        }
        if (user) {
          user.status = ACCOUNT_STATUS.BANNED;
          await user.save();
          targetUpdated = true;

          await createNotification({
            recipient: user._id,
            type: NOTIFICATION_TYPES.SYSTEM,
            title: 'Account Banned',
            message: 'Your UniMart AI account has been permanently banned due to severe policy violations.',
            link: `/profile`,
          });
        }
      }
    }

    report.status = REPORT_STATUS.RESOLVED;
    report.moderator = req.user._id;
    report.moderatedAt = new Date();
    report.moderationAction = moderationAction;
    report.moderationNote = (note || '').trim();
    await report.save();

    await report.populate('moderator', 'name email');
    await report.populate('reporter', 'name email department studentId');

    try {
      await createNotification({
        recipient: report.reporter?._id || report.reporter,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Report Resolved',
        message: 'A report you submitted has been reviewed and resolved by administrators.',
        link: '/my-reports',
      });
    } catch {
      // Best-effort delivery
    }

    const reportData = presentReport(report);

    return successResponse(res, {
      statusCode: 200,
      message: 'Report resolved successfully.',
      data: {
        ...reportData,
        report: reportData,
        targetUpdated,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/reports/:id/dismiss
 * @desc    Dismiss a report as invalid or non-violating
 * @access  Private (Admin only)
 */
export const dismissReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    if (!isValidObjectId(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report ID format.' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return errorResponse(res, { statusCode: 404, message: 'Report not found.' });
    }

    if (report.status === REPORT_STATUS.DISMISSED) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'This report has already been dismissed.',
      });
    }
    if (report.status === REPORT_STATUS.RESOLVED) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'This report was already resolved and cannot be dismissed.',
      });
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      return errorResponse(res, { statusCode: 400, message: 'Dismissal note must be text.' });
    }
    if (note && note.length > 1000) {
      return errorResponse(res, { statusCode: 400, message: 'Dismissal note cannot exceed 1000 characters.' });
    }

    report.status = REPORT_STATUS.DISMISSED;
    report.moderator = req.user._id;
    report.moderatedAt = new Date();
    report.moderationAction = MODERATION_ACTION.DISMISS;
    report.moderationNote = (note || 'Report dismissed as non-violating').trim();
    await report.save();

    await report.populate('moderator', 'name email');
    await report.populate('reporter', 'name email department studentId');

    try {
      await createNotification({
        recipient: report.reporter?._id || report.reporter,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Report Dismissed',
        message: 'A report you submitted has been reviewed and dismissed by administrators.',
        link: '/my-reports',
      });
    } catch {
      // Best-effort delivery
    }

    const reportData = presentReport(report);

    return successResponse(res, {
      statusCode: 200,
      message: 'Report dismissed successfully.',
      data: {
        ...reportData,
        report: reportData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/moderate/:targetType/:targetId or POST /api/v1/admin/moderate-target
 * @desc    Direct moderation action on a target entity
 * @access  Private (Admin only)
 */
export const moderateTarget = async (req, res, next) => {
  try {
    const rawTargetType = req.params.targetType || req.body?.targetType;
    const targetId = req.params.targetId || req.body?.targetId;
    const { action, note } = req.body || {};

    const upperType = normalizeTargetType(rawTargetType);
    if (!upperType || !Object.values(REPORT_TARGET).includes(upperType)) {
      return errorResponse(res, { statusCode: 400, message: `Invalid target type '${rawTargetType}'.` });
    }

    if (!targetId || !isValidObjectId(targetId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid target ID format.' });
    }

    if (!action || !Object.values(MODERATION_ACTION).includes(action)) {
      return errorResponse(res, { statusCode: 400, message: `Invalid or missing moderation action '${action}'.` });
    }

    const { target, targetExists, authorId } = await loadSafeTargetDetails(upperType, targetId);
    if (!targetExists) {
      return errorResponse(res, { statusCode: 404, message: 'The specified target content was not found.' });
    }

    let message = 'Moderation action applied.';

    if (action === MODERATION_ACTION.DEACTIVATE_PRODUCT) {
      if (upperType !== REPORT_TARGET.PRODUCT) {
        return errorResponse(res, { statusCode: 400, message: 'Action DEACTIVATE_PRODUCT is only valid for products.' });
      }
      await Product.updateOne(
        { _id: targetId },
        { $set: { status: PRODUCT_STATUS.INACTIVE, moderationStatus: MODERATION_STATUS.REJECTED } }
      );
      message = 'Product listing deactivated.';
    } else if (action === MODERATION_ACTION.CLOSE_WANTED_POST) {
      if (upperType !== REPORT_TARGET.WANTED_POST) {
        return errorResponse(res, { statusCode: 400, message: 'Action CLOSE_WANTED_POST is only valid for wanted posts.' });
      }
      await WantedPost.updateOne({ _id: targetId }, { $set: { status: WANTED_STATUS.CLOSED } });
      message = 'Wanted post closed.';
    } else if (action === MODERATION_ACTION.HIDE_REVIEW) {
      if (upperType !== REPORT_TARGET.REVIEW) {
        return errorResponse(res, { statusCode: 400, message: 'Action HIDE_REVIEW is only valid for reviews.' });
      }
      const review = await Review.findById(targetId);
      if (review) {
        review.status = REVIEW_STATUS.HIDDEN;
        await review.save();
        await refreshRevieweeReputation(review.reviewee);
        await refreshProductRating(review.product);
      }
      message = 'Review hidden and ratings recalculated.';
    } else if (action === MODERATION_ACTION.SUSPEND_USER) {
      const userId = upperType === REPORT_TARGET.USER ? targetId : authorId;
      await User.updateOne({ _id: userId, role: { $ne: 'admin' } }, { $set: { status: ACCOUNT_STATUS.SUSPENDED } });
      message = 'User account suspended.';
    } else if (action === MODERATION_ACTION.BAN_USER) {
      const userId = upperType === REPORT_TARGET.USER ? targetId : authorId;
      await User.updateOne({ _id: userId, role: { $ne: 'admin' } }, { $set: { status: ACCOUNT_STATUS.BANNED } });
      message = 'User account banned.';
    }

    return successResponse(res, {
      statusCode: 200,
      message,
      data: {
        targetType: upperType,
        targetId,
        action,
        moderator: {
          _id: req.user._id,
          name: req.user.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
