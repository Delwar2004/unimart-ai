import { ExchangeRequest, MAX_EXCHANGE_MESSAGE } from '../models/ExchangeRequest.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { Product } from '../models/Product.js';
import { LISTING_TYPES, NOTIFICATION_TYPES, PRODUCT_STATUS, REQUEST_STATUS } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import {
  openExchangeFromRequest,
  confirmExchangeRecord,
  cancelExchangeRecord,
} from '../services/exchangeService.js';
import { TransactionError } from '../services/transactionService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  isValidObjectId,
  parsePagination,
  parseStatusFilter,
  parseInterestMessage,
  toPublicUser,
  toPublicProduct,
  sameId,
} from '../utils/interest.js';

const userPopulate = { path: 'proposer', select: 'name avatarUrl department batch campusLocation' };
const ownerPopulate = { path: 'owner', select: 'name avatarUrl department batch campusLocation' };
const requestedPopulate = { path: 'requestedProduct', select: 'title price currency condition listingType status images seller' };
const offeredPopulate = { path: 'offeredProduct', select: 'title price currency condition listingType status images seller' };

const present = (doc, transaction = null) => ({
  _id: doc._id,
  requestedProduct: toPublicProduct(doc.requestedProduct),
  offeredProduct: toPublicProduct(doc.offeredProduct),
  proposer: toPublicUser(doc.proposer),
  owner: toPublicUser(doc.owner),
  message: doc.message || '',
  status: doc.status,
  exchangeTransaction: transaction
    ? {
        _id: transaction._id,
        status: transaction.status,
        proposerConfirmed: Boolean(transaction.proposerConfirmed),
        ownerConfirmed: Boolean(transaction.ownerConfirmed),
        completedAt: transaction.completedAt || null,
        cancelledAt: transaction.cancelledAt || null,
        cancellationReason: transaction.cancellationReason || '',
      }
    : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const notify = (payload) => createNotification(payload);

const loadOwned = async (id, userId) => {
  if (!isValidObjectId(id)) {
    return { error: { statusCode: 400, message: 'Invalid exchange request ID format.' } };
  }
  const request = await ExchangeRequest.findById(id)
    .populate(userPopulate)
    .populate(ownerPopulate)
    .populate(requestedPopulate)
    .populate(offeredPopulate);
  if (!request) return { error: { statusCode: 404, message: 'Exchange request not found.' } };
  const isProposer = sameId(request.proposer, userId);
  const isOwner = sameId(request.owner, userId);
  if (!isProposer && !isOwner) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this exchange request.' } };
  }
  return { request, isProposer, isOwner };
};

const attachTransactions = async (requests) => {
  const ids = requests.map((item) => item._id);
  const transactions = await ExchangeTransaction.find({ exchangeRequest: { $in: ids } }).lean();
  const byRequest = new Map(transactions.map((item) => [String(item.exchangeRequest), item]));
  return requests.map((item) => present(item, byRequest.get(String(item._id)) || null));
};

const listRequests = async (req, res, roleField) => {
  const { page, limit, skip } = parsePagination(req.query);
  const statusResult = parseStatusFilter(req.query);
  if (statusResult.error) return errorResponse(res, { statusCode: 400, message: statusResult.error });
  const filter = { [roleField]: req.user._id };
  if (statusResult.status) filter.status = statusResult.status;
  const total = await ExchangeRequest.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const requests = await ExchangeRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate(userPopulate)
    .populate(ownerPopulate)
    .populate(requestedPopulate)
    .populate(offeredPopulate)
    .lean();
  return successResponse(res, {
    statusCode: 200,
    message: 'Exchange requests retrieved successfully.',
    data: {
      requests: await attachTransactions(requests),
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
};

const sendServiceError = (res, error) => {
  if (error instanceof TransactionError || error?.statusCode) {
    return errorResponse(res, { statusCode: error.statusCode, message: error.message });
  }
  return null;
};

export const createExchangeRequest = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before requesting an exchange.' });
    }
    const requestedProductId = req.body?.requestedProductId;
    const offeredProductId = req.body?.offeredProductId;
    if (!isValidObjectId(requestedProductId) || !isValidObjectId(offeredProductId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }
    if (requestedProductId === offeredProductId) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot exchange a product with itself.' });
    }
    const parsedMessage = parseInterestMessage(req.body?.message, MAX_EXCHANGE_MESSAGE);
    if (parsedMessage.error) return errorResponse(res, { statusCode: 400, message: parsedMessage.error });

    const [requestedProduct, offeredProduct] = await Promise.all([
      Product.findById(requestedProductId).select('title seller status listingType'),
      Product.findById(offeredProductId).select('title seller status listingType'),
    ]);
    if (!requestedProduct || !offeredProduct) {
      return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });
    }
    if (requestedProduct.listingType !== LISTING_TYPES.EXCHANGE) {
      return errorResponse(res, { statusCode: 400, message: 'The requested product must be an exchange listing.' });
    }
    if (offeredProduct.listingType !== LISTING_TYPES.EXCHANGE) {
      return errorResponse(res, { statusCode: 400, message: 'The offered product must be an exchange listing.' });
    }
    if (requestedProduct.status !== PRODUCT_STATUS.AVAILABLE) {
      return errorResponse(res, { statusCode: 400, message: 'The requested product is not available.' });
    }
    if (offeredProduct.status !== PRODUCT_STATUS.AVAILABLE) {
      return errorResponse(res, { statusCode: 400, message: 'The offered product is not available.' });
    }
    if (sameId(requestedProduct.seller, req.user._id)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot request an exchange for your own product.' });
    }
    if (!sameId(offeredProduct.seller, req.user._id)) {
      return errorResponse(res, { statusCode: 403, message: 'You can only offer a product you own.' });
    }

    const existing = await ExchangeRequest.findOne({
      requestedProduct: requestedProduct._id,
      proposer: req.user._id,
      status: REQUEST_STATUS.PENDING,
    });
    if (existing) {
      return errorResponse(res, { statusCode: 409, message: 'You already have a pending exchange request for this product.' });
    }

    let created;
    try {
      created = await ExchangeRequest.create({
        requestedProduct: requestedProduct._id,
        offeredProduct: offeredProduct._id,
        proposer: req.user._id,
        owner: requestedProduct.seller,
        message: parsedMessage.message,
        status: REQUEST_STATUS.PENDING,
      });
    } catch (error) {
      if (error.code === 11000) {
        return errorResponse(res, { statusCode: 409, message: 'You already have a pending exchange request for this product.' });
      }
      throw error;
    }

    await notify({
      recipient: requestedProduct.seller,
      type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_RECEIVED,
      title: 'New exchange request',
      message: 'A student offered an item in exchange for your listing.',
      link: `/exchange-requests/${created._id}`,
      relatedProduct: requestedProduct._id,
      relatedUser: req.user._id,
    });

    const loaded = await loadOwned(created._id.toString(), req.user._id);
    return successResponse(res, {
      statusCode: 201,
      message: 'Exchange request sent.',
      data: present(loaded.request),
    });
  } catch (error) {
    next(error);
  }
};

export const getSentExchangeRequests = (req, res, next) => listRequests(req, res, 'proposer').catch(next);
export const getReceivedExchangeRequests = (req, res, next) => listRequests(req, res, 'owner').catch(next);

export const getExchangeRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    const transaction = await ExchangeTransaction.findOne({ exchangeRequest: loaded.request._id }).lean();
    return successResponse(res, {
      statusCode: 200,
      message: 'Exchange request retrieved successfully.',
      data: present(loaded.request, transaction),
    });
  } catch (error) {
    next(error);
  }
};

const transition = async (req, res, next, { actor, nextStatus, notifyPayload }) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (actor === 'owner' && !loaded.isOwner) {
      return errorResponse(res, { statusCode: 403, message: 'Only the listing owner can update this exchange request.' });
    }
    if (actor === 'proposer' && !loaded.isProposer) {
      return errorResponse(res, { statusCode: 403, message: 'Only the proposer can update this exchange request.' });
    }
    if (loaded.request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This exchange request is already ${loaded.request.status} and cannot be changed.`,
      });
    }
    loaded.request.status = nextStatus;
    await loaded.request.save();
    if (notifyPayload) await notify(notifyPayload(loaded.request));
    return successResponse(res, {
      statusCode: 200,
      message: 'Exchange request updated.',
      data: present(loaded.request),
    });
  } catch (error) {
    next(error);
  }
};

export const cancelExchangeRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'proposer',
    nextStatus: REQUEST_STATUS.CANCELLED,
    notifyPayload: (request) => ({
      recipient: request.owner?._id || request.owner,
      type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_CANCELLED,
      title: 'Exchange request cancelled',
      message: 'The exchange request was cancelled.',
      link: `/exchange-requests/${request._id}`,
      relatedProduct: request.requestedProduct?._id || request.requestedProduct,
      relatedUser: req.user._id,
    }),
  });

export const rejectExchangeRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'owner',
    nextStatus: REQUEST_STATUS.REJECTED,
    notifyPayload: (request) => ({
      recipient: request.proposer?._id || request.proposer,
      type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_REJECTED,
      title: 'Exchange request rejected',
      message: 'Your exchange request was rejected.',
      link: `/exchange-requests/${request._id}`,
      relatedProduct: request.requestedProduct?._id || request.requestedProduct,
      relatedUser: req.user._id,
    }),
  });

export const acceptExchangeRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (!loaded.isOwner) {
      return errorResponse(res, { statusCode: 403, message: 'Only the listing owner can update this exchange request.' });
    }
    if (loaded.request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This exchange request is already ${loaded.request.status} and cannot be changed.`,
      });
    }
    const transaction = await openExchangeFromRequest(loaded.request._id.toString(), req.user, { acceptPending: true });
    const refreshed = await loadOwned(req.params.id, req.user._id);
    await notify({
      recipient: refreshed.request.proposer?._id || refreshed.request.proposer,
      type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_ACCEPTED,
      title: 'Exchange request accepted',
      message: 'Your exchange request was accepted. Both listings are now reserved.',
      link: `/exchange-requests/${refreshed.request._id}`,
      relatedProduct: refreshed.request.requestedProduct?._id || refreshed.request.requestedProduct,
      relatedUser: req.user._id,
    });
    return successResponse(res, {
      statusCode: 200,
      message: 'Exchange request accepted.',
      data: present(refreshed.request, transaction),
      meta: { exchangeTransactionId: transaction._id },
    });
  } catch (error) {
    const sent = sendServiceError(res, error);
    if (sent) return sent;
    next(error);
  }
};

export const confirmExchangeTransaction = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid exchange transaction ID format.' });
    }
    const transaction = await confirmExchangeRecord(req.params.id, req.user);
    return successResponse(res, {
      statusCode: 200,
      message: 'Exchange confirmation saved.',
      data: transaction,
    });
  } catch (error) {
    const sent = sendServiceError(res, error);
    if (sent) return sent;
    next(error);
  }
};

export const cancelExchangeTransaction = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid exchange transaction ID format.' });
    }
    const transaction = await cancelExchangeRecord(req.params.id, req.user, req.body?.cancellationReason);
    return successResponse(res, {
      statusCode: 200,
      message: 'Exchange cancelled.',
      data: transaction,
    });
  } catch (error) {
    const sent = sendServiceError(res, error);
    if (sent) return sent;
    next(error);
  }
};
