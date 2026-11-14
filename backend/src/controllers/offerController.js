import { Offer, MAX_OFFER_MESSAGE, MAX_OFFER_AMOUNT } from '../models/Offer.js';
import { Product } from '../models/Product.js';
import { LISTING_TYPES, PRODUCT_STATUS, REQUEST_STATUS, NOTIFICATION_TYPES } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import { createTransactionFromOffer, TransactionError } from '../services/transactionService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  isValidObjectId,
  parsePagination,
  parseStatusFilter,
  parseInterestMessage,
  parseOfferAmount,
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
  amount: doc.amount,
  message: doc.message || '',
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const notify = (payload) => createNotification(payload);

const loadOwned = async (id, userId) => {
  if (!isValidObjectId(id)) {
    return { error: { statusCode: 400, message: 'Invalid offer ID format.' } };
  }

  const offer = await Offer.findById(id)
    .populate(productPopulate)
    .populate(userPopulate)
    .populate(sellerPopulate);

  if (!offer) {
    return { error: { statusCode: 404, message: 'Offer not found.' } };
  }

  const isBuyer = sameId(offer.buyer, userId);
  const isSeller = sameId(offer.seller, userId);
  if (!isBuyer && !isSeller) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this offer.' } };
  }

  return { offer, isBuyer, isSeller };
};

const listOffers = async (req, res, roleField) => {
  const { page, limit, skip } = parsePagination(req.query);
  const statusResult = parseStatusFilter(req.query);
  if (statusResult.error) {
    return errorResponse(res, { statusCode: 400, message: statusResult.error });
  }

  const filter = { [roleField]: req.user._id };
  if (statusResult.status) filter.status = statusResult.status;

  const total = await Offer.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const offers = await Offer.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate(productPopulate)
    .populate(userPopulate)
    .populate(sellerPopulate)
    .lean();

  return successResponse(res, {
    statusCode: 200,
    message: 'Offers retrieved successfully.',
    data: {
      offers: offers.map(present),
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
 * @route   POST /api/v1/offers
 * @desc    Create an offer on an available sale listing
 * @access  Private (verified)
 */
export const createOffer = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before making an offer.',
      });
    }

    const productId = req.body?.productId;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const parsedMessage = parseInterestMessage(req.body?.message, MAX_OFFER_MESSAGE);
    if (parsedMessage.error) {
      return errorResponse(res, { statusCode: 400, message: parsedMessage.error });
    }

    const parsedAmount = parseOfferAmount(req.body?.amount, MAX_OFFER_AMOUNT);
    if (parsedAmount.error) {
      return errorResponse(res, { statusCode: 400, message: parsedAmount.error });
    }

    const product = await Product.findById(productId).select('title seller status listingType price');
    if (!product) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Product listing not found.',
      });
    }

    if (product.listingType !== LISTING_TYPES.SELL) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Offers are only available on items listed for sale.',
      });
    }

    if (parsedAmount.amount <= 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Offer amount must be greater than zero.',
      });
    }

    if (product.status !== PRODUCT_STATUS.AVAILABLE) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'This product is not available for a new offer.',
      });
    }

    if (sameId(product.seller, req.user._id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'You cannot make an offer on your own product.',
      });
    }

    const existing = await Offer.findOne({
      product: product._id,
      buyer: req.user._id,
      status: REQUEST_STATUS.PENDING,
    });
    if (existing) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'You already have a pending offer for this product.',
      });
    }

    let created;
    try {
      created = await Offer.create({
        product: product._id,
        buyer: req.user._id,
        seller: product.seller,
        amount: parsedAmount.amount,
        message: parsedMessage.message,
        status: REQUEST_STATUS.PENDING,
      });
    } catch (error) {
      if (error.code === 11000) {
        return errorResponse(res, {
          statusCode: 409,
          message: 'You already have a pending offer for this product.',
        });
      }
      throw error;
    }

    const offer = await Offer.findById(created._id)
      .populate(productPopulate)
      .populate(userPopulate)
      .populate(sellerPopulate);

    await notify({
      recipient: product.seller,
      type: NOTIFICATION_TYPES.OFFER_RECEIVED,
      title: 'New offer received',
      message: 'You received a new offer for your product.',
      link: `/offers/${created._id}`,
      relatedProduct: product._id,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: 201,
      message: 'Offer sent.',
      data: present(offer),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/offers/sent
 * @access  Private
 */
export const getSentOffers = async (req, res, next) => {
  try {
    return await listOffers(req, res, 'buyer');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/offers/received
 * @access  Private
 */
export const getReceivedOffers = async (req, res, next) => {
  try {
    return await listOffers(req, res, 'seller');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/offers/:id
 * @access  Private (buyer or seller)
 */
export const getOffer = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);

    return successResponse(res, {
      statusCode: 200,
      message: 'Offer retrieved successfully.',
      data: present(loaded.offer),
    });
  } catch (error) {
    next(error);
  }
};

const transition = async (req, res, next, { actor, nextStatus, notifyPayload }) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);

    const { offer, isBuyer, isSeller } = loaded;
    if (actor === 'buyer' && !isBuyer) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the buyer can cancel this offer.',
      });
    }
    if (actor === 'seller' && !isSeller) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the seller can update this offer.',
      });
    }

    if (offer.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This offer is already ${offer.status} and cannot be changed.`,
      });
    }

    if (nextStatus === REQUEST_STATUS.ACCEPTED) {
      const product = await Product.findById(offer.product?._id || offer.product).select('status listingType');
      if (!product || product.status !== PRODUCT_STATUS.AVAILABLE || product.listingType !== LISTING_TYPES.SELL) {
        return errorResponse(res, {
          statusCode: 409,
          message: 'This product is no longer available, so the offer cannot be accepted.',
        });
      }
    }

    offer.status = nextStatus;
    await offer.save();

    await notify(notifyPayload(offer));

    return successResponse(res, {
      statusCode: 200,
      message: `Offer ${nextStatus}.`,
      data: present(offer),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/offers/:id/cancel
 * @access  Private (buyer, pending only)
 */
export const cancelOffer = (req, res, next) =>
  transition(req, res, next, {
    actor: 'buyer',
    nextStatus: REQUEST_STATUS.CANCELLED,
    notifyPayload: (offer) => ({
      recipient: offer.seller?._id || offer.seller,
      type: NOTIFICATION_TYPES.OFFER_CANCELLED,
      title: 'Offer cancelled',
      message: 'An offer for your product was cancelled.',
      link: `/offers/${offer._id}`,
      relatedProduct: offer.product?._id || offer.product,
      relatedUser: req.user._id,
    }),
  });

/**
 * @route   PATCH /api/v1/offers/:id/accept
 * @access  Private (seller, pending only)
 */
export const acceptOffer = async (req, res, next) => {
  try {
    const loaded = await loadOwned(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (!loaded.isSeller) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Only the seller can update this offer.',
      });
    }
    if (loaded.offer.status !== REQUEST_STATUS.PENDING) {
      return errorResponse(res, {
        statusCode: 409,
        message: `This offer is already ${loaded.offer.status} and cannot be changed.`,
      });
    }

    const transaction = await createTransactionFromOffer(loaded.offer._id.toString(), req.user, {
      acceptPending: true,
    });
    const refreshed = await loadOwned(req.params.id, req.user._id);
    const offer = refreshed.offer || loaded.offer;

    await notify({
      recipient: offer.buyer?._id || offer.buyer,
      type: NOTIFICATION_TYPES.OFFER_ACCEPTED,
      title: 'Offer accepted',
      message: 'Your offer was accepted.',
      link: `/offers/${offer._id}`,
      relatedProduct: offer.product?._id || offer.product,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Offer accepted.',
      data: present(offer),
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
 * @route   PATCH /api/v1/offers/:id/reject
 * @access  Private (seller, pending only)
 */
export const rejectOffer = (req, res, next) =>
  transition(req, res, next, {
    actor: 'seller',
    nextStatus: REQUEST_STATUS.REJECTED,
    notifyPayload: (offer) => ({
      recipient: offer.buyer?._id || offer.buyer,
      type: NOTIFICATION_TYPES.OFFER_REJECTED,
      title: 'Offer rejected',
      message: 'Your offer was rejected.',
      link: `/offers/${offer._id}`,
      relatedProduct: offer.product?._id || offer.product,
      relatedUser: req.user._id,
    }),
  });
