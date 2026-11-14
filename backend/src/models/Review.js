import mongoose from 'mongoose';
import { REVIEW_STATUS, REVIEW_TYPE } from '../constants/index.js';

export const MAX_REVIEW_COMMENT = 1000;

const reviewSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    exchangeTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExchangeTransaction',
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewee is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer from 1 to 5',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_REVIEW_COMMENT, `Comment cannot exceed ${MAX_REVIEW_COMMENT} characters`],
    },
    type: {
      type: String,
      enum: Object.values(REVIEW_TYPE),
      required: [true, 'Review type is required'],
    },
    status: {
      type: String,
      enum: Object.values(REVIEW_STATUS),
      default: REVIEW_STATUS.PUBLISHED,
    },
  },
  { timestamps: true }
);

reviewSchema.pre('validate', function rejectAmbiguousSource(next) {
  const hasSale = Boolean(this.transaction);
  const hasExchange = Boolean(this.exchangeTransaction);
  if (hasSale === hasExchange) {
    this.invalidate('transaction', 'A review must reference exactly one completed sale or exchange.');
  }
  next();
});

reviewSchema.index(
  { transaction: 1, reviewer: 1, type: 1 },
  { unique: true, partialFilterExpression: { transaction: { $type: 'objectId' } } }
);
reviewSchema.index(
  { exchangeTransaction: 1, reviewer: 1, type: 1 },
  { unique: true, partialFilterExpression: { exchangeTransaction: { $type: 'objectId' } } }
);
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ reviewee: 1, status: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
