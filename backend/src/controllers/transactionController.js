import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import {
  ACTIVE_TRANSACTION_STATUSES,
  TRANSACTION_STATUS,
} from '../constants/index.js';
import {
  confirmTransactionRecord,
  cancelTransactionRecord,
  TransactionError,
} from '../services/transactionService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  isValidObjectId,
  parsePagination,
  toPublicUser,
  toPublicProduct,
  sameId,
  productPopulate,
  userPopulate,
  sellerPopulate,
} from '../utils/interest.js';

const present = (doc) => ({
  _id: doc._id,
  product: toPublicProduct(doc.product),
  buyer: toPublicUser(doc.buyer),
  seller: toPublicUser(doc.seller),
  sourceType: doc.sourceType,
  sourceRequest: doc.sourceRequest?._id || doc.sourceRequest || null,
  sourceOffer: doc.sourceOffer?._id || doc.sourceOffer || null,
  sourceGiveaway: doc.sourceGiveaway?._id || doc.sourceGiveaway || null,
  agreedPrice: doc.agreedPrice,
  status: doc.status,
  buyerConfirmed: Boolean(doc.buyerConfirmed),
  sellerConfirmed: Boolean(doc.sellerConfirmed),
  completedAt: doc.completedAt || null,
  cancelledAt: doc.cancelledAt || null,
  cancellationReason: doc.cancellationReason || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const readQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const statusFilter = (query) => {
  const raw = readQueryValue(query.status);
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw !== 'string') return { error: 'Invalid status filter.' };
  if (raw === 'confirmed') {
    return {
      status: {
        $in: [TRANSACTION_STATUS.CONFIRMED_BY_BUYER, TRANSACTION_STATUS.CONFIRMED_BY_SELLER],
      },
    };
  }
  if (!Object.values(TRANSACTION_STATUS).includes(raw)) {
    return { error: 'Invalid status filter.' };
  }
  return { status: raw };
};

const loadForParty = async (id, userId) => {
  if (!isValidObjectId(id)) {
    return { error: { statusCode: 400, message: 'Invalid transaction ID format.' } };
  }
  const transaction = await Transaction.findById(id)
    .populate(productPopulate)
    .populate(userPopulate)
    .populate(sellerPopulate);
  if (!transaction) {
    return { error: { statusCode: 404, message: 'Transaction not found.' } };
  }
  if (!sameId(transaction.buyer, userId) && !sameId(transaction.seller, userId)) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this transaction.' } };
  }
  return { transaction };
};

const sendServiceError = (res, error) => {
  if (error instanceof TransactionError || error?.statusCode) {
    return errorResponse(res, { statusCode: error.statusCode, message: error.message });
  }
  return null;
};

/**
 * @route   GET /api/v1/transactions
 * @access  Private
 */
export const getTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = statusFilter(req.query);
    if (status.error) {
      return errorResponse(res, { statusCode: 400, message: status.error });
    }

    const participation = readQueryValue(req.query.participation);
    const filter = {};
    if (participation === 'purchase') filter.buyer = req.user._id;
    else if (participation === 'sale') filter.seller = req.user._id;
    else if (participation === undefined || participation === null || participation === '') {
      filter.$or = [{ buyer: req.user._id }, { seller: req.user._id }];
    } else {
      return errorResponse(res, { statusCode: 400, message: 'Invalid participation filter.' });
    }

    if (readQueryValue(req.query.active) === 'true') {
      filter.status = { $in: ACTIVE_TRANSACTION_STATUSES };
    } else if (status.status) {
      filter.status = status.status;
    }

    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(productPopulate)
      .populate(userPopulate)
      .populate(sellerPopulate)
      .lean();

    return successResponse(res, {
      statusCode: 200,
      message: 'Transactions retrieved successfully.',
      data: {
        transactions: transactions.map(present),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/transactions/:id
 * @access  Private (buyer or seller)
 */
export const getTransaction = async (req, res, next) => {
  try {
    const loaded = await loadForParty(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    return successResponse(res, {
      statusCode: 200,
      message: 'Transaction retrieved successfully.',
      data: present(loaded.transaction),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/transactions/:id/confirm
 * @access  Private (buyer or seller)
 */
export const confirmTransaction = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid transaction ID format.' });
    }
    const transaction = await confirmTransactionRecord(req.params.id, req.user);
    const loaded = await loadForParty(transaction._id.toString(), req.user._id);
    return successResponse(res, {
      statusCode: 200,
      message: 'Transaction confirmation saved.',
      data: present(loaded.transaction),
    });
  } catch (error) {
    const sent = sendServiceError(res, error);
    if (sent) return sent;
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/transactions/:id/cancel
 * @access  Private (buyer or seller)
 */
export const cancelTransaction = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid transaction ID format.' });
    }
    const transaction = await cancelTransactionRecord(req.params.id, req.user, req.body?.cancellationReason);
    const loaded = await loadForParty(transaction._id.toString(), req.user._id);
    return successResponse(res, {
      statusCode: 200,
      message: 'Transaction cancelled.',
      data: present(loaded.transaction),
    });
  } catch (error) {
    const sent = sendServiceError(res, error);
    if (sent) return sent;
    next(error);
  }
};
