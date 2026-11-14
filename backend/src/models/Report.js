import mongoose from 'mongoose';
import { REPORT_REASON, REPORT_STATUS, REPORT_TARGET } from '../constants/index.js';

export const MAX_REPORT_DESCRIPTION = 1000;

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
    },
    targetType: {
      type: String,
      enum: Object.values(REPORT_TARGET),
      required: [true, 'Report target type is required'],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Report target is required'],
    },
    reason: {
      type: String,
      enum: Object.values(REPORT_REASON),
      required: [true, 'Report reason is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_REPORT_DESCRIPTION, `Description cannot exceed ${MAX_REPORT_DESCRIPTION} characters`],
    },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.PENDING,
    },
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    moderationAction: {
      type: String,
      trim: true,
      default: '',
    },
    moderationNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Moderation note cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: REPORT_STATUS.PENDING } }
);

export const Report = mongoose.model('Report', reportSchema);
