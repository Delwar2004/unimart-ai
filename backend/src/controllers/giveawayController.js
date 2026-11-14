import { GiveawayRequest, MAX_GIVEAWAY_MESSAGE } from '../models/GiveawayRequest.js';
import { Product } from '../models/Product.js';
import { LISTING_TYPES, NOTIFICATION_TYPES, PRODUCT_STATUS, REQUEST_STATUS } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import { createTransactionFromGiveaway, TransactionError } from '../services/transactionService.js';
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

const requesterPopulate = { path: 'requester', select: 'name avatarUrl department batch campusLocation' };
const ownerPopulate = { path: 'owner', select: 'name avatarUrl department batch campusLocation' };
const productPopulate = { path: 'product', select: 'title price currency condition listingType status images' };

const present = (doc) => ({
  _id: doc._id,
  product: toPublicProduct(doc.product),
  requester: toPublicUser(doc.requester),
  owner: toPublicUser(doc.owner),
  message: doc.message || '',
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const notify = (payload) => createNotification(payload);

const loadOwned = async (id, userId) => {
  if (!isValidObjectId(id)) {
    return { error: { statusCode: 400, message: 'Invalid giveaway request ID format.' } };
  }
  const request = await GiveawayRequest.findById(id)
    .populate(requesterPopulate)
    .populate(ownerPopulate)
    .populate(productPopulate);
  if (!request) return { error: { statusCode: 404, message: 'Giveaway request not found.' } };
  const isRequester = sameId(request.requester, userId);
  const isOwner = sameId(request.owner, userId);
  if (!isRequester && !isOwner) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this giveaway request.' } };
  }
  return { request, isRequester, isOwner };
};

const listRequests = async (req, res, roleField) => {
  const { page, limit, skip } = parsePagination(req.query);
  const statusResult = parseStatusFilter(req.query);
  if (statusResult.error) return errorResponse(res, { statusCode: 400, message: statusResult.error });
  const filter = { [roleField]: req.user._id };
  if (statusResult.status) filter.status = statusResult.status;
  const total = await GiveawayRequest.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const requests = await GiveawayRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate(requesterPopulate)
    .populate(ownerPopulate)
    .populate(productPopulate)
    .lean();
  return successResponse(res, {
    statusCode: 200,
    message: 'Giveaway requests retrieved successfully.',
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

export const createGiveawayRequest = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before requesting a giveaway.' });
    }
    const productId = req.body?.productId;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }
    const parsedMessage = parseInterestMessage(req.body?.message, MAX_GIVEAWAY_MESSAGE);
    if (parsedMessage.error) return errorResponse(res, { statusCode: 400, message: parsedMessage.error });

    const product = await Product.findById(productId).select('title seller status listingType');
    if (!product) return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });
    if (product.listingType !== LISTING_TYPES.GIVEAWAY) {
      return errorResponse(res, { statusCode: 400, message: 'This product is not a giveaway listing.' });
    }
    if (product.status !== PRODUCT_STATUS.AVAILABLE) {
      return errorResponse(res, { statusCode: 400, message: 'This giveaway is not available.' });
    }
    if (sameId(product.seller, req.user._id)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot request your own giveaway.' });
    }

    const existing = await GiveawayRequest.findOne({
      product: product._id,
      requester: req.user._id,
      status: REQUEST_STATUS.PENDING,
    });
    if (existing) {
      return errorResponse(res, { statusCode: 409, message: 'You already have a pending request for this giveaway.' });
    }

    let created;
    try {
      created = await GiveawayRequest.create({
        product: product._id,
        requester: req.user._id,
        owner: product.seller,
        message: parsedMessage.message,
        status: REQUEST_STATUS.PENDING,
      });
    } catch (error) {
      if (error.code === 11000) {
        return errorResponse(res, { statusCode: 409, message: 'You already have a pending request for this giveaway.' });
      }
      throw error;
    }

    await notify({
      recipient: product.seller,
      type: NOTIFICATION_TYPES.GIVEAWAY_REQUEST_RECEIVED,
      title: 'New giveaway request',
      message: 'A student asked to receive your giveaway.',
      link: `/giveaway-requests/${created._id}`,
      relatedProduct: product._id,
      relatedUser: req.user._id,
    });

    const loaded = await loadOwned(created._id.toString(), req.user._id);
    return successResponse(res, {
      statusCode: 201,
      message: 'Giveaway request sent.',
      data: present(loaded.request),
    });
  } catch (error) {
    next(error);
  }
};

export const getSentGiveawayRequests = (req, res, next) => listRequests(req, res, 'requester').catch(next);
export const getReceivedGiveawayRequests = (req, res, next) => listRequests(req, res, 'owner').catch(next);

export const getGiveawayRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    return successResponse(res, {
      statusCode: 200,
      message: 'Giveaway request retrieved successfully.',
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
    if (actor === 'owner' && !loaded.isOwner) {
      return errorResponse(res, { statusCode: 403, message: 'Only the listing owner can update this giveaway request.' });
    }
    if (actor === 'requester' && !loaded.isRequester) {
      return errorResponse(res, { statusCode: 403, message: 'Only the requester can update this giveaway request.' });
    }
    if (loaded.request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This giveaway request is already ${loaded.request.status} and cannot be changed.`,
      });
    }
    loaded.request.status = nextStatus;
    await loaded.request.save();
    if (notifyPayload) await notify(notifyPayload(loaded.request));
    return successResponse(res, {
      statusCode: 200,
      message: 'Giveaway request updated.',
      data: present(loaded.request),
    });
  } catch (error) {
    next(error);
  }
};

export const cancelGiveawayRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'requester',
    nextStatus: REQUEST_STATUS.CANCELLED,
    notifyPayload: (request) => ({
      recipient: request.owner?._id || request.owner,
      type: NOTIFICATION_TYPES.GIVEAWAY_REQUEST_CANCELLED,
      title: 'Giveaway request cancelled',
      message: 'The giveaway request was cancelled.',
      link: `/giveaway-requests/${request._id}`,
      relatedProduct: request.product?._id || request.product,
      relatedUser: req.user._id,
    }),
  });

export const rejectGiveawayRequest = (req, res, next) =>
  transition(req, res, next, {
    actor: 'owner',
    nextStatus: REQUEST_STATUS.REJECTED,
    notifyPayload: (request) => ({
      recipient: request.requester?._id || request.requester,
      type: NOTIFICATION_TYPES.GIVEAWAY_REQUEST_REJECTED,
      title: 'Giveaway request rejected',
      message: 'Your giveaway request was rejected.',
      link: `/giveaway-requests/${request._id}`,
      relatedProduct: request.product?._id || request.product,
      relatedUser: req.user._id,
    }),
  });

export const acceptGiveawayRequest = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (!loaded.isOwner) {
      return errorResponse(res, { statusCode: 403, message: 'Only the listing owner can update this giveaway request.' });
    }
    if (loaded.request.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This giveaway request is already ${loaded.request.status} and cannot be changed.`,
      });
    }
    const transaction = await createTransactionFromGiveaway(loaded.request._id.toString(), req.user, { acceptPending: true });
    const refreshed = await loadOwned(req.params.id, req.user._id);
    await notify({
      recipient: refreshed.request.requester?._id || refreshed.request.requester,
      type: NOTIFICATION_TYPES.GIVEAWAY_REQUEST_ACCEPTED,
      title: 'Giveaway request accepted',
      message: 'Your giveaway request was accepted. The listing is now reserved.',
      link: `/giveaway-requests/${refreshed.request._id}`,
      relatedProduct: refreshed.request.product?._id || refreshed.request.product,
      relatedUser: req.user._id,
    });
    return successResponse(res, {
      statusCode: 200,
      message: 'Giveaway request accepted.',
      data: present(refreshed.request),
      meta: { transactionId: transaction._id },
    });
  } catch (error) {
    if (error instanceof TransactionError) {
      return errorResponse(res, { statusCode: error.statusCode, message: error.message });
    }
    next(error);
  }
};
