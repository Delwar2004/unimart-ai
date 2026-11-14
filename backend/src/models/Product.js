import mongoose from 'mongoose';
import {
  LISTING_TYPES,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  MODERATION_STATUS,
} from '../constants/index.js';

const productImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    publicId: {
      type: String,
      default: '',
    },
    isThumbnail: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subCategory: {
      type: String,
      trim: true,
      default: '',
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required'],
    },
    listingType: {
      type: String,
      enum: Object.values(LISTING_TYPES),
      default: LISTING_TYPES.SELL,
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    currency: {
      type: String,
      default: 'BDT',
      trim: true,
    },
    condition: {
      type: String,
      enum: Object.values(PRODUCT_CONDITIONS),
      default: PRODUCT_CONDITIONS.GOOD,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    campusLocation: {
      type: String,
      trim: true,
      required: [true, 'Campus location is required'],
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.AVAILABLE,
    },
    exchangePreferences: {
      type: String,
      trim: true,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    moderationStatus: {
      type: String,
      enum: Object.values(MODERATION_STATUS),
      default: MODERATION_STATUS.PENDING,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Foundational Compound and Text Indexes
productSchema.index({ seller: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ listingType: 1, status: 1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, viewsCount: -1 });
productSchema.index({ createdAt: -1 });

// Full text search index
productSchema.index(
  {
    title: 'text',
    description: 'text',
    tags: 'text',
  },
  {
    weights: {
      title: 5,
      tags: 3,
      description: 1,
    },
    name: 'ProductTextIndex',
  }
);

export const Product = mongoose.model('Product', productSchema);
