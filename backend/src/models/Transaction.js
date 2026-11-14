import mongoose from 'mongoose';
import { TRANSACTION_SOURCE, TRANSACTION_STATUS } from '../constants/index.js';

export const MAX_CANCELLATION_REASON = 500;

const transactionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer is required'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required'],
    },
    sourceType: {
      type: String,
      enum: Object.values(TRANSACTION_SOURCE),
      required: [true, 'Transaction source is required'],
    },
    sourceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BuyRequest',
      default: null,
    },
    sourceOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      default: null,
    },
    sourceGiveaway: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiveawayRequest',
      default: null,
    },
    agreedPrice: {
      type: Number,
      required: [true, 'Agreed price is required'],
      min: [0, 'Agreed price cannot be negative'],
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
    },
    buyerConfirmed: {
      type: Boolean,
      default: false,
    },
    sellerConfirmed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_CANCELLATION_REASON, `Cancellation reason cannot exceed ${MAX_CANCELLATION_REASON} characters`],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ buyer: 1, createdAt: -1 });
transactionSchema.index({ seller: 1, createdAt: -1 });
transactionSchema.index({ product: 1, status: 1 });
transactionSchema.index({ sourceRequest: 1 }, { sparse: true });
transactionSchema.index({ sourceOffer: 1 }, { sparse: true });
transactionSchema.index({ sourceGiveaway: 1 }, { sparse: true });
transactionSchema.index(
  { product: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
