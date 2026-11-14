import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

export const MAX_OFFER_MESSAGE = 1000;
export const MAX_OFFER_AMOUNT = 10000000;

const offerSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: [true, 'Offer amount is required'],
      min: [0, 'Offer amount cannot be negative'],
      max: [MAX_OFFER_AMOUNT, `Offer amount cannot exceed ${MAX_OFFER_AMOUNT}`],
    },
    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_OFFER_MESSAGE, `Message cannot exceed ${MAX_OFFER_MESSAGE} characters`],
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

offerSchema.index({ buyer: 1, createdAt: -1 });
offerSchema.index({ seller: 1, createdAt: -1 });
offerSchema.index(
  { product: 1, buyer: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.PENDING },
  }
);

export const Offer = mongoose.model('Offer', offerSchema);
