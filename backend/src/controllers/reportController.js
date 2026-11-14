import { Report } from '../models/Report.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Review } from '../models/Review.js';
import { WantedPost } from '../models/WantedPost.js';
import { Message } from '../models/Message.js';
import { MAX_REPORT_DESCRIPTION } from '../models/Report.js';
import { REPORT_REASON, REPORT_STATUS, REPORT_TARGET } from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isValidObjectId, parsePagination, sameId } from '../utils/interest.js';

const present = (doc) => ({
  _id: doc._id,
  reporter: doc.reporter
    ? doc.reporter._id
      ? {
          _id: doc.reporter._id,
          name: doc.reporter.name,
          email: doc.reporter.email,
          department: doc.reporter.department || '',
          studentId: doc.reporter.studentId || '',
        }
      : doc.reporter
    : null,
  targetType: doc.targetType,
  targetId: doc.targetId,
  reason: doc.reason,
  description: doc.description || '',
  status: doc.status,
  moderator: doc.moderator
    ? doc.moderator._id
      ? {
          _id: doc.moderator._id,
          name: doc.moderator.name,
          email: doc.moderator.email,
        }
      : doc.moderator
    : null,
  moderatedAt: doc.moderatedAt || null,
  moderationAction: doc.moderationAction || '',
  moderationNote: doc.moderationNote || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const paginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return { page, limit, totalItems: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
};

const loadTarget = async (targetType, targetId) => {
  if (targetType === REPORT_TARGET.PRODUCT) return Product.findById(targetId).select('_id seller');
  if (targetType === REPORT_TARGET.USER) return User.findById(targetId).select('_id');
  if (targetType === REPORT_TARGET.REVIEW) return Review.findById(targetId).select('_id reviewer');
  if (targetType === REPORT_TARGET.WANTED_POST) return WantedPost.findById(targetId).select('_id author');
  if (targetType === REPORT_TARGET.MESSAGE) return Message.findById(targetId).select('_id sender');
  return null;
};

const ownsTarget = (targetType, target, userId) => {
  if (!target) return false;
  if (targetType === REPORT_TARGET.PRODUCT) return sameId(target.seller, userId);
  if (targetType === REPORT_TARGET.USER) return sameId(target._id, userId);
  if (targetType === REPORT_TARGET.REVIEW) return sameId(target.reviewer, userId);
  if (targetType === REPORT_TARGET.WANTED_POST) return sameId(target.author, userId);
  if (targetType === REPORT_TARGET.MESSAGE) return sameId(target.sender, userId);
  return false;
};

export const createReport = async (req, res, next) => {
  try {
    if (!req.user?.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before submitting a report.' });
    }

    const targetType = req.body?.targetType;
    const reason = req.body?.reason;
    const targetId = req.body?.targetId;
    const descriptionInput = req.body?.description;

    if (typeof targetType !== 'string' || !Object.values(REPORT_TARGET).includes(targetType)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report target type.' });
    }
    if (!isValidObjectId(targetId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid target ID format.' });
    }
    if (typeof reason !== 'string' || !Object.values(REPORT_REASON).includes(reason)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report reason.' });
    }
    if (descriptionInput !== undefined && descriptionInput !== null && descriptionInput !== '' && typeof descriptionInput !== 'string') {
      return errorResponse(res, { statusCode: 400, message: 'Description must be plain text.' });
    }
    const description = typeof descriptionInput === 'string' ? descriptionInput.trim() : '';
    if (description.length > MAX_REPORT_DESCRIPTION) {
      return errorResponse(res, { statusCode: 400, message: `Description cannot exceed ${MAX_REPORT_DESCRIPTION} characters.` });
    }

    const target = await loadTarget(targetType, targetId);
    if (!target) return errorResponse(res, { statusCode: 404, message: 'The reported item was not found.' });
    if (ownsTarget(targetType, target, req.user._id)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot report your own content.' });
    }

    const duplicate = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      status: REPORT_STATUS.PENDING,
    }).select('_id');
    if (duplicate) {
      return errorResponse(res, { statusCode: 409, message: 'You already have a pending report for this item.' });
    }

    let report;
    try {
      report = await Report.create({
        reporter: req.user._id,
        targetType,
        targetId,
        reason,
        description,
        status: REPORT_STATUS.PENDING,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return errorResponse(res, { statusCode: 409, message: 'You already have a pending report for this item.' });
      }
      throw error;
    }

    return successResponse(res, { statusCode: 201, message: 'Report submitted.', data: present(report) });
  } catch (error) {
    next(error);
  }
};

export const getMyReports = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 10);
    const filter = { reporter: req.user._id };
    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Report.countDocuments(filter),
    ]);
    return successResponse(res, {
      statusCode: 200,
      message: 'Your reports retrieved.',
      data: reports.map(present),
      meta: { pagination: paginationMeta(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report ID format.' });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return errorResponse(res, { statusCode: 404, message: 'Report not found.' });
    if (!sameId(report.reporter, req.user._id)) {
      return errorResponse(res, { statusCode: 403, message: 'You cannot access this report.' });
    }
    return successResponse(res, { statusCode: 200, message: 'Report retrieved.', data: present(report) });
  } catch (error) {
    next(error);
  }
};

export const withdrawReport = async (req, res, next) => {
  try {
    if (!req.user?.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before withdrawing a report.' });
    }
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid report ID format.' });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return errorResponse(res, { statusCode: 404, message: 'Report not found.' });
    if (!sameId(report.reporter, req.user._id)) {
      return errorResponse(res, { statusCode: 403, message: 'You cannot withdraw this report.' });
    }
    if (report.status !== REPORT_STATUS.PENDING) {
      return errorResponse(res, { statusCode: 409, message: 'Only pending reports can be withdrawn.' });
    }
    const id = report._id;
    await report.deleteOne();
    return successResponse(res, { statusCode: 200, message: 'Report withdrawn.', data: { _id: id } });
  } catch (error) {
    next(error);
  }
};
