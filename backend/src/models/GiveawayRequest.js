import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

export const MAX_GIVEAWAY_MESSAGE = 1000;

const giveawayRequestSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
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
      maxlength: [MAX_GIVEAWAY_MESSAGE, `Message cannot exceed ${MAX_GIVEAWAY_MESSAGE} characters`],
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

giveawayRequestSchema.index({ requester: 1, createdAt: -1 });
giveawayRequestSchema.index({ owner: 1, createdAt: -1 });
giveawayRequestSchema.index(
  { product: 1, requester: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.PENDING },
  }
);

export const GiveawayRequest = mongoose.model('GiveawayRequest', giveawayRequestSchema);
