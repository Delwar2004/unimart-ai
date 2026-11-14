import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

export const MAX_EXCHANGE_MESSAGE = 1000;

const exchangeRequestSchema = new mongoose.Schema(
  {
    offeredProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Offered product is required'],
    },
    requestedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Requested product is required'],
    },
    proposer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Proposer is required'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_EXCHANGE_MESSAGE, `Message cannot exceed ${MAX_EXCHANGE_MESSAGE} characters`],
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

exchangeRequestSchema.index({ proposer: 1, createdAt: -1 });
exchangeRequestSchema.index({ owner: 1, createdAt: -1 });
exchangeRequestSchema.index(
  { requestedProduct: 1, proposer: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.PENDING },
  }
);

export const ExchangeRequest = mongoose.model('ExchangeRequest', exchangeRequestSchema);
