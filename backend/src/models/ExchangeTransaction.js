import mongoose from 'mongoose';
import { EXCHANGE_TRANSACTION_STATUS } from '../constants/index.js';

export const MAX_EXCHANGE_CANCELLATION_REASON = 500;

const exchangeTransactionSchema = new mongoose.Schema(
  {
    exchangeRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExchangeRequest',
      required: [true, 'Exchange request is required'],
    },
    requestedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    offeredProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    products: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      required: true,
    },
    proposer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(EXCHANGE_TRANSACTION_STATUS),
      default: EXCHANGE_TRANSACTION_STATUS.PENDING,
    },
    proposerConfirmed: {
      type: Boolean,
      default: false,
    },
    ownerConfirmed: {
      type: Boolean,
      default: false,
    },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: MAX_EXCHANGE_CANCELLATION_REASON,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

exchangeTransactionSchema.index({ proposer: 1, createdAt: -1 });
exchangeTransactionSchema.index({ owner: 1, createdAt: -1 });
exchangeTransactionSchema.index({ requestedProduct: 1, status: 1 });
exchangeTransactionSchema.index({ offeredProduct: 1, status: 1 });
exchangeTransactionSchema.index({ exchangeRequest: 1 });
exchangeTransactionSchema.index(
  { products: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

export const ExchangeTransaction = mongoose.model('ExchangeTransaction', exchangeTransactionSchema);
