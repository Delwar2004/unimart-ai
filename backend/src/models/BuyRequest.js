import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

export const MAX_BUY_REQUEST_MESSAGE = 1000;

const buyRequestSchema = new mongoose.Schema(
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
    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_BUY_REQUEST_MESSAGE, `Message cannot exceed ${MAX_BUY_REQUEST_MESSAGE} characters`],
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
    },
  },
  {
    timestamps: true,
  }
);

buyRequestSchema.index({ buyer: 1, createdAt: -1 });
buyRequestSchema.index({ seller: 1, createdAt: -1 });
buyRequestSchema.index(
  { product: 1, buyer: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.PENDING },
  }
);

export const BuyRequest = mongoose.model('BuyRequest', buyRequestSchema);
