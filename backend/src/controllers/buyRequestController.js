import { BuyRequest, MAX_BUY_REQUEST_MESSAGE } from '../models/BuyRequest.js';
import { Product } from '../models/Product.js';
import { LISTING_TYPES, PRODUCT_STATUS, REQUEST_STATUS, NOTIFICATION_TYPES } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import { createTransactionFromBuyRequest, TransactionError } from '../services/transactionService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  isValidObjectId,
  parsePagination,
  parseStatusFilter,
  parseInterestMessage,
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
  message: doc.message || '',
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const notify = (payload) => createNotification(payload);

const loadOwned = async (id, userId) => {
  if (!isValidObjectId(id)) {
    return { error: { statusCode: 400, message: 'Invalid buy request ID format.' } };
  }

  const request = await BuyRequest.findById(id)
    .populate(productPopulate)
    .populate(userPopulate)
    .populate(sellerPopulate);

  if (!request) {
    return { error: { statusCode: 404, message: 'Buy request not found.' } };
  }

  const isBuyer = sameId(request.buyer, userId);
  const isSeller = sameId(request.seller, userId);
  if (!isBuyer && !isSeller) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this buy request.' } };
  }

  return { request, isBuyer, isSeller };
};

const listRequests = async (req, res, roleField) => {
  const { page, limit, skip } = parsePagination(req.query);
  const statusResult = parseStatusFilter(req.query);
  if (statusResult.error) {
    return errorResponse(res, { statusCode: 400, message: statusResult.error });
  }

  const filter = { [roleField]: req.user._id };
  if (statusResult.status) filter.status = statusResult.status;

  const total = await BuyRequest.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const requests = await BuyRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate(productPopulate)
    .populate(userPopulate)
    .populate(sellerPopulate)
    .lean();

  return successResponse(res, {
    statusCode: 200,
    message: 'Buy requests retrieved successfully.',
    data: {
      requests: requests.map(present),
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

/**
 * @route   POST /api/v1/buy-requests
 * @desc    Create a buy request for an available product
 * @access  Private (verified)
 */
export const createBuyRequest = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before sending a buy request.',
      });
    }

    const productId = req.body?.productId;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const parsedMessage = parseInterestMessage(req.body?.message, MAX_BUY_REQUEST_MESSAGE);
    if (parsedMessage.error) {
      return errorResponse(res, { statusCode: 400, message: parsedMessage.error });
    }

    const product = await Product.findById(productId).select('title seller status listingType');
    if (!product) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Product listing not found.',
      });
    }

    if (product.status !== PRODUCT_STATUS.AVAILABLE) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'This product is not available for a new buy request.',
      });
    }

    if (sameId(product.seller, req.user._id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'You cannot request your own product.',
      });
    }

    if (product.listingType !== LISTING_TYPES.SELL) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Buy requests are only available on items listed for sale.',
      });
    }

    const existing = await BuyRequest.findOne({
      product: product._id,
      buyer: req.user._id,
      status: REQUEST_STATUS.PENDING,
    });
    if (existing) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'You already have a pending buy request for this product.',
      });
    }

    let created;
    try {
      created = await BuyRequest.create({
        product: product._id,
        buyer: req.user._id,
        seller: product.seller,
        message: parsedMessage.message,
        status: REQUEST_STATUS.PENDING,
      });
    } catch (error) {
      if (error.code === 11000) {
        return errorResponse(res, {
          statusCode: 409,
          message: 'You already have a pending buy request for this product.',
        });
      }
      throw error;
    }

    const request = await BuyRequest.findById(created._id)
      .populate(productPopulate)
      .populate(userPopulate)
      .populate(sellerPopulate);

    await notify({
      recipient: product.seller,
      type: NOTIFICATION_TYPES.BUY_REQUEST_RECEIVED,
      title: 'New buy request',
      message: 'Someone is interested in buying your product.',
      link: `/buy-requests/${created._id}`,
      relatedProduct: product._id,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: 201,
      message: 'Buy request sent.',
      data: present(request),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/buy-requests/sent
 * @access  Private
 */
export const getSentBuyRequests = async (req, res, next) => {
  try {
    return await listRequests(req, res, 'buyer');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/buy-requests/received
 * @access  Private
 */
export const getReceivedBuyRequests = async (req, res, next) => {
  try {
    return await listRequests(req, res, 'seller');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/buy-requests/:id
 * @access  Private (buyer or seller)
 */
export const getBuyRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);

    return successResponse(res, {
      statusCode: 200,
      message: 'Buy request retrieved successfully.',
      data: present(loaded.request),
    });
  } catch (error) {
    next(error);
  }
};

const transition = async (req, res, next, { actor, nextStatus, notifyPayload }) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);

    const { request, isBuyer, isSeller } = loaded;
    if (actor === 'buyer' && !isBuyer) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the buyer can cancel this buy request.',
      });
    }
    if (actor === 'seller' && !isSeller) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the seller can update this buy request.',
      });
    }

    if (request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This buy request is already ${request.status} and cannot be changed.`,
      });
    }

    if (nextStatus === REQUEST_STATUS.ACCEPTED) {
      const product = await Product.findById(request.product?._id || request.product).select('status');
      if (!product || product.status !== PRODUCT_STATUS.AVAILABLE) {
        return errorResponse(res, {
          statusCode: 409,
          message: 'This product is no longer available, so the buy request cannot be accepted.',
        });
      }
    }

    request.status = nextStatus;
    await request.save();

    await notify(notifyPayload(request));

    return successResponse(res, {
      statusCode: 200,
      message: `Buy request ${nextStatus}.`,
      data: present(request),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/buy-requests/:id/cancel
 * @access  Private (buyer, pending only)
 */
export const cancelBuyRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'buyer',
    nextStatus: REQUEST_STATUS.CANCELLED,
    notifyPayload: (request) => ({
      recipient: request.seller?._id || request.seller,
      type: NOTIFICATION_TYPES.BUY_REQUEST_CANCELLED,
      title: 'Buy request cancelled',
      message: 'A buy request for your product was cancelled.',
      link: `/buy-requests/${request._id}`,
      relatedProduct: request.product?._id || request.product,
      relatedUser: req.user._id,
    }),
  });

/**
 * @route   PATCH /api/v1/buy-requests/:id/accept
 * @access  Private (seller, pending only)
 */
export const acceptBuyRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (!loaded.isSeller) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the seller can update this buy request.',
      });
    }
    if (loaded.request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This buy request is already ${loaded.request.status} and cannot be changed.`,
      });
    }

    const transaction = await createTransactionFromBuyRequest(loaded.request._id.toString(), req.user, {
      acceptPending: true,
    });
    const refreshed = await loadOwned(req.params.id, req.user._id);
    const request = refreshed.request || loaded.request;

    await notify({
      recipient: request.buyer?._id || request.buyer,
      type: NOTIFICATION_TYPES.BUY_REQUEST_ACCEPTED,
      title: 'Buy request accepted',
      message: 'Your buy request was accepted.',
      link: `/buy-requests/${request._id}`,
      relatedProduct: request.product?._id || request.product,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Buy request accepted.',
      data: present(request),
      meta: { transactionId: transaction._id },
    });
  } catch (error) {
    if (error instanceof TransactionError) {
      return errorResponse(res, { statusCode: error.statusCode, message: error.message });
    }
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/buy-requests/:id/reject
 * @access  Private (seller, pending only)
 */
export const rejectBuyRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'seller',
    nextStatus: REQUEST_STATUS.REJECTED,
    notifyPayload: (request) => ({
      recipient: request.buyer?._id || request.buyer,
      type: NOTIFICATION_TYPES.BUY_REQUEST_REJECTED,
      title: 'Buy request rejected',
      message: 'Your buy request was rejected.',
      link: `/buy-requests/${request._id}`,
      relatedProduct: request.product?._id || request.product,
      relatedUser: req.user._id,
    }),
  });
