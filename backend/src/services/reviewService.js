import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Transaction } from '../models/Transaction.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { REVIEW_STATUS, REVIEW_TYPE, TRANSACTION_STATUS, EXCHANGE_TRANSACTION_STATUS } from '../constants/index.js';
import { sameId } from '../utils/interest.js';

export class ReviewError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const asObjectId = (value) => new mongoose.Types.ObjectId(String(value?._id || value));

const round1 = (value) => Math.round((Number(value) + Number.EPSILON) * 10) / 10;

export const refreshRevieweeReputation = async (userId) => {
  const revieweeId = asObjectId(userId);
  const [row] = await Review.aggregate([
    { $match: { reviewee: revieweeId, status: REVIEW_STATUS.PUBLISHED } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratingsCount = row?.count || 0;
  const averageRating = ratingsCount ? round1(row.average) : 0;
  await User.updateOne(
    { _id: revieweeId },
    { $set: { 'reputation.averageRating': averageRating, 'reputation.ratingsCount': ratingsCount } }
  );
  return { averageRating, ratingsCount };
};

export const refreshProductRating = async (productId) => {
  const productObjectId = asObjectId(productId);
  const [row] = await Review.aggregate([
    { $match: { product: productObjectId, status: REVIEW_STATUS.PUBLISHED } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratingCount = row?.count || 0;
  const averageRating = ratingCount ? round1(row.average) : 0;
  await Product.updateOne({ _id: productObjectId }, { $set: { averageRating, ratingCount } });
  return { averageRating, ratingCount };
};

const existingReviewQuery = (kind, recordId, userId, type) =>
  kind === 'EXCHANGE'
    ? { exchangeTransaction: recordId, reviewer: userId, type }
    : { transaction: recordId, reviewer: userId, type };

/**
 * Decide whether a user may review a completed sale or exchange.
 * Identity and direction come from the stored transaction, not the client.
 */
export const canReviewTransaction = async (transactionId, userId) => {
  const sale = await Transaction.findById(transactionId);
  const exchange = sale ? null : await ExchangeTransaction.findById(transactionId);
  const record = sale || exchange;
  if (!record) return { eligible: false, reason: 'not_found' };

  const kind = sale ? 'SALE' : 'EXCHANGE';
  const completed = sale
    ? record.status === TRANSACTION_STATUS.COMPLETED
    : record.status === EXCHANGE_TRANSACTION_STATUS.COMPLETED;
  if (!completed) return { eligible: false, reason: 'not_completed', kind, status: record.status };

  let type;
  let reviewee;
  let product;
  if (sale) {
    if (sameId(record.buyer, userId)) {
      type = REVIEW_TYPE.BUYER_TO_SELLER;
      reviewee = record.seller;
      product = record.product;
    } else if (sameId(record.seller, userId)) {
      type = REVIEW_TYPE.SELLER_TO_BUYER;
      reviewee = record.buyer;
      product = record.product;
    } else {
      return { eligible: false, reason: 'not_participant', kind };
    }
  } else if (sameId(record.proposer, userId)) {
    type = REVIEW_TYPE.BUYER_TO_SELLER;
    reviewee = record.owner;
    product = record.requestedProduct;
  } else if (sameId(record.owner, userId)) {
    type = REVIEW_TYPE.SELLER_TO_BUYER;
    reviewee = record.proposer;
    product = record.offeredProduct;
  } else {
    return { eligible: false, reason: 'not_participant', kind };
  }

  const existing = await Review.findOne(existingReviewQuery(kind, record._id, userId, type)).select('_id');
  if (existing) {
    return { eligible: false, reason: 'already_reviewed', kind, type, reviewId: existing._id, reviewee, product };
  }

  return { eligible: true, kind, type, reviewee, product, record };
};

export const createReviewRecord = async ({ transactionId, userId, rating, comment }) => {
  const decision = await canReviewTransaction(transactionId, userId);
  if (!decision.eligible) {
    if (decision.reason === 'not_found') throw new ReviewError(404, 'Transaction not found.');
    if (decision.reason === 'already_reviewed') throw new ReviewError(409, 'You have already reviewed this transaction.');
    if (decision.reason === 'not_participant') throw new ReviewError(403, 'Only the students in this transaction can leave a review.');
    throw new ReviewError(403, 'Reviews are available only after the transaction is completed.');
  }

  const payload = {
    product: decision.product,
    reviewer: userId,
    reviewee: decision.reviewee,
    rating,
    comment,
    type: decision.type,
    status: REVIEW_STATUS.PUBLISHED,
    transaction: decision.kind === 'SALE' ? decision.record._id : null,
    exchangeTransaction: decision.kind === 'EXCHANGE' ? decision.record._id : null,
  };

  let review;
  try {
    review = await Review.create(payload);
  } catch (error) {
    if (error?.code === 11000) throw new ReviewError(409, 'You have already reviewed this transaction.');
    throw error;
  }

  await Promise.all([refreshProductRating(decision.product), refreshRevieweeReputation(decision.reviewee)]);
  return review;
};
