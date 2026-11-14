import mongoose from 'mongoose';
import { WANTED_STATUS } from '../constants/index.js';

export const MAX_WANTED_TITLE = 120;
export const MAX_WANTED_DESCRIPTION = 2000;
export const MAX_WANTED_BUDGET = 10000000;
export const MAX_WANTED_LOCATION = 120;

const wantedPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [MAX_WANTED_TITLE, `Title cannot exceed ${MAX_WANTED_TITLE} characters`],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [MAX_WANTED_DESCRIPTION, `Description cannot exceed ${MAX_WANTED_DESCRIPTION} characters`],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    budgetMin: {
      type: Number,
      default: null,
      min: [0, 'Budget cannot be negative'],
      max: [MAX_WANTED_BUDGET, `Budget cannot exceed ${MAX_WANTED_BUDGET}`],
    },
    budgetMax: {
      type: Number,
      default: null,
      min: [0, 'Budget cannot be negative'],
      max: [MAX_WANTED_BUDGET, `Budget cannot exceed ${MAX_WANTED_BUDGET}`],
    },
    campusLocation: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_WANTED_LOCATION, `Campus location cannot exceed ${MAX_WANTED_LOCATION} characters`],
    },
    status: {
      type: String,
      enum: Object.values(WANTED_STATUS),
      default: WANTED_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

wantedPostSchema.index({ status: 1, createdAt: -1 });
wantedPostSchema.index({ category: 1, status: 1, createdAt: -1 });

export const WantedPost = mongoose.model('WantedPost', wantedPostSchema);
