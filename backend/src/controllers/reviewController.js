import { Review, MAX_REVIEW_COMMENT } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { NOTIFICATION_TYPES, REVIEW_STATUS } from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isValidObjectId, parsePagination, toPublicUser, sameId } from '../utils/interest.js';
import { createNotification } from '../services/notificationService.js';
import {
  ReviewError,
  canReviewTransaction,
  createReviewRecord,
  refreshProductRating,
  refreshRevieweeReputation,
} from '../services/reviewService.js';

const REVIEWER_FIELDS = 'name avatarUrl department batch campusLocation';

const parseRating = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    return { error: 'Rating must be an integer from 1 to 5.' };
  }
  return { rating: value };
};

const parseComment = (value) => {
  if (value === undefined || value === null || value === '') return { comment: '' };
  if (typeof value !== 'string') return { error: 'Comment must be plain text.' };
  const comment = value.trim();
  if (comment.length > MAX_REVIEW_COMMENT) {
    return { error: `Comment cannot exceed ${MAX_REVIEW_COMMENT} characters.` };
  }
  return { comment };
};

const present = (doc) => ({
  _id: doc._id,
  transaction: doc.transaction?._id || doc.transaction || null,
  exchangeTransaction: doc.exchangeTransaction?._id || doc.exchangeTransaction || null,
  product: doc.product && doc.product._id
    ? { _id: doc.product._id, title: doc.product.title || '' }
    : doc.product || null,
  reviewer: toPublicUser(doc.reviewer) || doc.reviewer,
  reviewee: toPublicUser(doc.reviewee) || (doc.reviewee ? { _id: doc.reviewee } : null),
  rating: doc.rating,
  comment: doc.comment || '',
  type: doc.type,
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const paginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    totalItems: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

const requireVerified = (user) => {
  if (!user?.isVerified) {
    return 'You must verify your university email before reviewing a transaction.';
  }
  return null;
};

export const createReview = async (req, res, next) => {
  try {
    const verificationError = requireVerified(req.user);
    if (verificationError) return errorResponse(res, { statusCode: 403, message: verificationError });

    const transactionId = req.body?.transactionId;
    if (!isValidObjectId(transactionId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid transaction ID format.' });
    }
    const rating = parseRating(req.body?.rating);
    if (rating.error) return errorResponse(res, { statusCode: 400, message: rating.error });
    const comment = parseComment(req.body?.comment);
    if (comment.error) return errorResponse(res, { statusCode: 400, message: comment.error });

    const review = await createReviewRecord({
      transactionId,
      userId: req.user._id,
      rating: rating.rating,
      comment: comment.comment,
    });
    const populated = await Review.findById(review._id)
      .populate('reviewer', REVIEWER_FIELDS)
      .populate('reviewee', REVIEWER_FIELDS)
      .populate('product', 'title');

    await createNotification({
      recipient: review.reviewee,
      type: NOTIFICATION_TYPES.REVIEW_RECEIVED,
      title: 'New review received',
      message: 'You received a new review for a completed transaction.',
      link: `/users/${review.reviewee}`,
      relatedProduct: review.product,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: 201,
      message: 'Review published.',
      data: present(populated),
    });
  } catch (error) {
    if (error instanceof ReviewError) {
      return errorResponse(res, { statusCode: error.statusCode, message: error.message });
    }
    next(error);
  }
};

export const getProductReviews = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.productId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }
    const product = await Product.findById(req.params.productId).select('_id averageRating ratingCount');
    if (!product) return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });

    const { page, limit, skip } = parsePagination(req.query, 10);
    const filter = { product: product._id, status: REVIEW_STATUS.PUBLISHED };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('reviewer', REVIEWER_FIELDS)
        .populate('reviewee', REVIEWER_FIELDS)
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return successResponse(res, {
      statusCode: 200,
      message: 'Product reviews retrieved.',
      data: reviews.map(present),
      meta: {
        pagination: paginationMeta(page, limit, total),
        averageRating: product.averageRating || 0,
        ratingCount: product.ratingCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid user ID format.' });
    }
    const user = await User.findById(req.params.userId).select('_id reputation');
    if (!user) return errorResponse(res, { statusCode: 404, message: 'User profile not found.' });

    const { page, limit, skip } = parsePagination(req.query, 10);
    const filter = { reviewee: user._id, status: REVIEW_STATUS.PUBLISHED };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('reviewer', REVIEWER_FIELDS)
        .populate('reviewee', REVIEWER_FIELDS)
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return successResponse(res, {
      statusCode: 200,
      message: 'Reviews for this student retrieved.',
      data: reviews.map(present),
      meta: {
        pagination: paginationMeta(page, limit, total),
        averageRating: user.reputation?.averageRating || 0,
        ratingsCount: user.reputation?.ratingsCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReviews = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 10);
    const filter = { reviewer: req.user._id };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('reviewer', REVIEWER_FIELDS)
        .populate('reviewee', REVIEWER_FIELDS)
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);
    return successResponse(res, {
      statusCode: 200,
      message: 'Your reviews retrieved.',
      data: reviews.map(present),
      meta: { pagination: paginationMeta(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

export const checkEligibility = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.transactionId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid transaction ID format.' });
    }
    const decision = await canReviewTransaction(req.params.transactionId, req.user._id);
    if (decision.reason === 'not_found') {
      return errorResponse(res, { statusCode: 404, message: 'Transaction not found.' });
    }
    let review = null;
    if (decision.reviewId) {
      const existing = await Review.findById(decision.reviewId)
        .populate('reviewer', REVIEWER_FIELDS)
        .populate('reviewee', REVIEWER_FIELDS)
        .populate('product', 'title');
      review = existing ? present(existing) : null;
    }
    return successResponse(res, {
      statusCode: 200,
      message: 'Review eligibility checked.',
      data: {
        eligible: Boolean(decision.eligible),
        type: decision.type || null,
        review,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const verificationError = requireVerified(req.user);
    if (verificationError) return errorResponse(res, { statusCode: 403, message: verificationError });
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid review ID format.' });
    }
    const review = await Review.findById(req.params.id);
    if (!review) return errorResponse(res, { statusCode: 404, message: 'Review not found.' });
    if (!sameId(review.reviewer, req.user._id)) {
      return errorResponse(res, { statusCode: 403, message: 'Only the reviewer can edit this review.' });
    }

    if (req.body?.rating !== undefined) {
      const rating = parseRating(req.body.rating);
      if (rating.error) return errorResponse(res, { statusCode: 400, message: rating.error });
      review.rating = rating.rating;
    }
    if (req.body?.comment !== undefined) {
      const comment = parseComment(req.body.comment);
      if (comment.error) return errorResponse(res, { statusCode: 400, message: comment.error });
      review.comment = comment.comment;
    }
    await review.save();
    await Promise.all([refreshProductRating(review.product), refreshRevieweeReputation(review.reviewee)]);
    const populated = await Review.findById(review._id)
      .populate('reviewer', REVIEWER_FIELDS)
      .populate('reviewee', REVIEWER_FIELDS)
      .populate('product', 'title');
    return successResponse(res, { statusCode: 200, message: 'Review updated.', data: present(populated) });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const verificationError = requireVerified(req.user);
    if (verificationError) return errorResponse(res, { statusCode: 403, message: verificationError });
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid review ID format.' });
    }
    const review = await Review.findById(req.params.id);
    if (!review) return errorResponse(res, { statusCode: 404, message: 'Review not found.' });
    if (!sameId(review.reviewer, req.user._id)) {
      return errorResponse(res, { statusCode: 403, message: 'Only the reviewer can delete this review.' });
    }
    const { product, reviewee, _id } = review;
    await review.deleteOne();
    await Promise.all([refreshProductRating(product), refreshRevieweeReputation(reviewee)]);
    return successResponse(res, { statusCode: 200, message: 'Review deleted.', data: { _id } });
  } catch (error) {
    next(error);
  }
};
