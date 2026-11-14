import { BuyRequest } from '../models/BuyRequest.js';
import { Offer } from '../models/Offer.js';
import { GiveawayRequest } from '../models/GiveawayRequest.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import {
  ACTIVE_TRANSACTION_STATUSES,
  LISTING_TYPES,
  NOTIFICATION_TYPES,
  PRODUCT_STATUS,
  REQUEST_STATUS,
  TRANSACTION_SOURCE,
  TRANSACTION_STATUS,
} from '../constants/index.js';
import { createNotification } from './notificationService.js';
import { notifyWishlistOnStatusChange } from './notificationService.js';
import { MAX_CANCELLATION_REASON } from '../models/Transaction.js';

export class TransactionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'TransactionError';
    this.statusCode = statusCode;
  }
}

const sameId = (left, right) => {
  if (!left || !right) return false;
  const leftId = left._id || left;
  const rightId = right._id || right;
  return leftId.toString() === rightId.toString();
};

const idOf = (value) => value?._id || value;

const isActiveStatus = (status) => ACTIVE_TRANSACTION_STATUSES.includes(status);

const notifyQuietly = (payload) => createNotification(payload);

const reserveProduct = async (productId) => {
  const updated = await Product.findOneAndUpdate(
    { _id: productId, status: PRODUCT_STATUS.AVAILABLE },
    { $set: { status: PRODUCT_STATUS.RESERVED } },
    { new: true }
  );
  if (!updated) {
    throw new TransactionError(409, 'This product is not available for a transaction.');
  }
  return updated;
};

const releaseProductIfIdle = async (productId) => {
  const [activeCount, exchangeCount] = await Promise.all([
    Transaction.countDocuments({
      product: productId,
      status: { $in: ACTIVE_TRANSACTION_STATUSES },
    }),
    ExchangeTransaction.countDocuments({
      products: productId,
      isActive: true,
    }),
  ]);
  if (activeCount > 0 || exchangeCount > 0) return false;
  const released = await Product.findOneAndUpdate(
    { _id: productId, status: PRODUCT_STATUS.RESERVED },
    { $set: { status: PRODUCT_STATUS.AVAILABLE } },
    { new: true }
  );
  return Boolean(released);
};

const markSoldIfReserved = async (productId) => {
  const sold = await Product.findOneAndUpdate(
    { _id: productId, status: PRODUCT_STATUS.RESERVED },
    { $set: { status: PRODUCT_STATUS.SOLD } },
    { new: true }
  );
  if (!sold) {
    throw new TransactionError(409, 'The product is no longer reserved, so the transaction cannot be completed.');
  }
  await notifyWishlistOnStatusChange(sold, PRODUCT_STATUS.RESERVED, PRODUCT_STATUS.SOLD);
  return sold;
};

const rejectOtherInterest = async (productId, { keepRequestId = null, keepOfferId = null } = {}) => {
  const requestFilter = { product: productId, status: REQUEST_STATUS.PENDING };
  const offerFilter = { product: productId, status: REQUEST_STATUS.PENDING };
  if (keepRequestId) requestFilter._id = { $ne: keepRequestId };
  if (keepOfferId) offerFilter._id = { $ne: keepOfferId };

  const [requests, offers] = await Promise.all([
    BuyRequest.find(requestFilter).select('_id buyer'),
    Offer.find(offerFilter).select('_id buyer'),
  ]);

  if (requests.length) {
    await BuyRequest.updateMany(requestFilter, { $set: { status: REQUEST_STATUS.REJECTED } });
  }
  if (offers.length) {
    await Offer.updateMany(offerFilter, { $set: { status: REQUEST_STATUS.REJECTED } });
  }

  await Promise.all([
    ...requests.map((request) =>
      notifyQuietly({
        recipient: request.buyer,
        type: NOTIFICATION_TYPES.BUY_REQUEST_REJECTED,
        title: 'Buy request rejected',
        message: 'Product is now reserved by another transaction.',
        link: `/buy-requests/${request._id}`,
        relatedProduct: productId,
      })
    ),
    ...offers.map((offer) =>
      notifyQuietly({
        recipient: offer.buyer,
        type: NOTIFICATION_TYPES.OFFER_REJECTED,
        title: 'Offer rejected',
        message: 'Product is now reserved by another transaction.',
        link: `/offers/${offer._id}`,
        relatedProduct: productId,
      })
    ),
  ]);
};

const notifyTransactionCreated = async (transaction) => {
  const payload = {
    type: NOTIFICATION_TYPES.TRANSACTION_CREATED,
    title: 'Transaction started',
    message: 'A transaction was created and the product is now reserved.',
    link: `/transactions/${transaction._id}`,
    relatedProduct: transaction.product,
  };
  await Promise.all([
    notifyQuietly({ ...payload, recipient: transaction.buyer, relatedUser: transaction.seller }),
    notifyQuietly({ ...payload, recipient: transaction.seller, relatedUser: transaction.buyer }),
  ]);
};

const assertParty = (record, actor) => {
  if (!actor?._id) {
    throw new TransactionError(401, 'Authentication is required.');
  }
  if (!actor.isVerified) {
    throw new TransactionError(403, 'You must verify your university email before managing a transaction.');
  }
  const isBuyer = sameId(record.buyer, actor._id);
  const isSeller = sameId(record.seller, actor._id);
  if (!isBuyer && !isSeller) {
    throw new TransactionError(403, 'You are not allowed to access this transaction.');
  }
  return { isBuyer, isSeller };
};

const assertSeller = (record, actor) => {
  const party = assertParty(record, actor);
  if (!party.isSeller) {
    throw new TransactionError(403, 'Only the seller can open this transaction.');
  }
  return party;
};

const agreedPriceFromProduct = (product) => {
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) {
    throw new TransactionError(400, 'This product does not have a valid price for a transaction.');
  }
  return product.price;
};

const rollbackOpen = async ({ productId, transactionId, record, previousStatus }) => {
  if (transactionId) {
    await Transaction.deleteOne({ _id: transactionId });
  }
  if (record && previousStatus && record.status !== previousStatus) {
    record.status = previousStatus;
    await record.save();
  }
  if (productId) {
    await releaseProductIfIdle(productId);
  }
};

const rejectOtherGiveaways = async (productId, keepId) => {
  const filter = { product: productId, status: REQUEST_STATUS.PENDING };
  if (keepId) filter._id = { $ne: keepId };
  const requests = await GiveawayRequest.find(filter).select('_id requester');
  if (!requests.length) return;
  await GiveawayRequest.updateMany(filter, { $set: { status: REQUEST_STATUS.REJECTED } });
  await Promise.all(
    requests.map((request) =>
      notifyQuietly({
        recipient: request.requester,
        type: NOTIFICATION_TYPES.GIVEAWAY_REQUEST_REJECTED,
        title: 'Giveaway request rejected',
        message: 'Product is now reserved by another transaction.',
        link: `/giveaway-requests/${request._id}`,
        relatedProduct: productId,
      })
    )
  );
};

const openFromSource = async ({
  record,
  actor,
  acceptPending,
  sourceType,
  agreedPrice,
  sourceRequest,
  sourceOffer,
  sourceGiveaway,
  keepRequestId,
  keepOfferId,
  keepGiveawayId,
}) => {
  assertSeller(record, actor);

  const sourceFilter = sourceGiveaway
    ? { sourceGiveaway: record._id }
    : sourceRequest
      ? { sourceRequest: record._id }
      : { sourceOffer: record._id };
  const existing = await Transaction.findOne(sourceFilter);
  if (existing) {
    if (acceptPending && record.status === REQUEST_STATUS.PENDING) {
      record.status = REQUEST_STATUS.ACCEPTED;
      await record.save();
    }
    return { transaction: existing, createdNow: false };
  }

  if (record.status === REQUEST_STATUS.PENDING) {
    if (!acceptPending) {
      throw new TransactionError(409, 'The request or offer must be accepted before a transaction can be created.');
    }
  } else if (record.status !== REQUEST_STATUS.ACCEPTED) {
    throw new TransactionError(409, 'Only an accepted buy request or offer can start a transaction.');
  }

  const active = await Transaction.findOne({
    product: idOf(record.product),
    status: { $in: ACTIVE_TRANSACTION_STATUSES },
  }).select('_id');
  if (active) {
    throw new TransactionError(409, 'An active transaction already exists for this product.');
  }

  const product = await Product.findById(idOf(record.product));
  if (!product) {
    throw new TransactionError(404, 'Product listing not found.');
  }
  if (sourceType === TRANSACTION_SOURCE.OFFER && product.listingType !== LISTING_TYPES.SELL) {
    throw new TransactionError(400, 'Offers are only available on items listed for sale.');
  }
  if (sourceType === TRANSACTION_SOURCE.GIVEAWAY_REQUEST && product.listingType !== LISTING_TYPES.GIVEAWAY) {
    throw new TransactionError(400, 'This listing is not a giveaway.');
  }
  if (sourceType === TRANSACTION_SOURCE.BUY_REQUEST && product.listingType !== LISTING_TYPES.SELL) {
    throw new TransactionError(400, 'Buy requests are only available on items listed for sale.');
  }
  if (product.status !== PRODUCT_STATUS.AVAILABLE) {
    throw new TransactionError(409, 'This product is not available for a transaction.');
  }

  const previousStatus = record.status;
  let reserved = false;
  let created = null;
  try {
    await reserveProduct(product._id);
    reserved = true;
    created = await Transaction.create({
      product: product._id,
      buyer: idOf(record.buyer),
      seller: idOf(record.seller),
      sourceType,
      sourceRequest: sourceRequest || null,
      sourceOffer: sourceOffer || null,
      sourceGiveaway: sourceGiveaway || null,
      agreedPrice,
      status: TRANSACTION_STATUS.PENDING,
      buyerConfirmed: false,
      sellerConfirmed: false,
      isActive: true,
    });
    if (record.status !== REQUEST_STATUS.ACCEPTED) {
      record.status = REQUEST_STATUS.ACCEPTED;
      await record.save();
    }
    await rejectOtherInterest(product._id, { keepRequestId, keepOfferId });
    if (sourceType === TRANSACTION_SOURCE.GIVEAWAY_REQUEST) {
      await rejectOtherGiveaways(product._id, keepGiveawayId);
    }
    return { transaction: created, createdNow: true };
  } catch (error) {
    if (reserved || created) {
      await rollbackOpen({
        productId: product._id,
        transactionId: created?._id,
        record,
        previousStatus,
      });
    }
    if (error?.code === 11000) {
      throw new TransactionError(409, 'An active transaction already exists for this product.');
    }
    throw error;
  }
};

export const createTransactionFromBuyRequest = async (requestId, actor, options = {}) => {
  const request = await BuyRequest.findById(requestId);
  if (!request) {
    throw new TransactionError(404, 'Buy request not found.');
  }
  const product = await Product.findById(request.product).select('price status listingType');
  if (!product) {
    throw new TransactionError(404, 'Product listing not found.');
  }

  const opened = await openFromSource({
    record: request,
    actor,
    acceptPending: Boolean(options.acceptPending),
    sourceType: TRANSACTION_SOURCE.BUY_REQUEST,
    agreedPrice: agreedPriceFromProduct(product),
    sourceRequest: request._id,
    keepRequestId: request._id,
  });

  if (options.notify !== false && opened.createdNow) {
    await notifyTransactionCreated(opened.transaction);
  }
  return opened.transaction;
};

export const createTransactionFromOffer = async (offerId, actor, options = {}) => {
  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new TransactionError(404, 'Offer not found.');
  }
  if (typeof offer.amount !== 'number' || !Number.isFinite(offer.amount) || offer.amount <= 0) {
    throw new TransactionError(400, 'This offer does not have a valid amount.');
  }

  const opened = await openFromSource({
    record: offer,
    actor,
    acceptPending: Boolean(options.acceptPending),
    sourceType: TRANSACTION_SOURCE.OFFER,
    agreedPrice: offer.amount,
    sourceOffer: offer._id,
    keepOfferId: offer._id,
  });

  if (options.notify !== false && opened.createdNow) {
    await notifyTransactionCreated(opened.transaction);
  }
  return opened.transaction;
};

export const createTransactionFromGiveaway = async (requestId, actor, options = {}) => {
  const request = await GiveawayRequest.findById(requestId);
  if (!request) {
    throw new TransactionError(404, 'Giveaway request not found.');
  }
  const product = await Product.findById(request.product).select('price status listingType');
  if (!product) {
    throw new TransactionError(404, 'Product listing not found.');
  }
  if (product.listingType !== LISTING_TYPES.GIVEAWAY) {
    throw new TransactionError(400, 'This listing is not a giveaway.');
  }

  const record = {
    _id: request._id,
    product: request.product,
    buyer: request.requester,
    seller: request.owner,
    get status() {
      return request.status;
    },
    set status(value) {
      request.status = value;
    },
    save: () => request.save(),
  };

  const opened = await openFromSource({
    record,
    actor,
    acceptPending: Boolean(options.acceptPending),
    sourceType: TRANSACTION_SOURCE.GIVEAWAY_REQUEST,
    agreedPrice: 0,
    sourceGiveaway: request._id,
    keepGiveawayId: request._id,
  });

  if (options.notify !== false && opened.createdNow) {
    await notifyTransactionCreated(opened.transaction);
  }
  return opened.transaction;
};

export const releaseReservedProductIfIdle = releaseProductIfIdle;
export const reserveAvailableProduct = reserveProduct;
export const markReservedProductSold = markSoldIfReserved;

export const confirmTransactionRecord = async (transactionId, actor) => {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new TransactionError(404, 'Transaction not found.');
  }
  const { isBuyer, isSeller } = assertParty(transaction, actor);

  if (transaction.status === TRANSACTION_STATUS.CANCELLED) {
    throw new TransactionError(409, 'A cancelled transaction cannot be confirmed.');
  }
  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    throw new TransactionError(409, 'A completed transaction cannot be confirmed again.');
  }
  if (!isActiveStatus(transaction.status)) {
    throw new TransactionError(409, 'This transaction cannot be confirmed.');
  }
  if (isBuyer && transaction.buyerConfirmed) {
    throw new TransactionError(409, 'You have already confirmed this transaction.');
  }
  if (isSeller && transaction.sellerConfirmed) {
    throw new TransactionError(409, 'You have already confirmed this transaction.');
  }

  const nextBuyerConfirmed = isBuyer ? true : transaction.buyerConfirmed;
  const nextSellerConfirmed = isSeller ? true : transaction.sellerConfirmed;
  const bothConfirmed = nextBuyerConfirmed && nextSellerConfirmed;
  const nextStatus = bothConfirmed
    ? TRANSACTION_STATUS.COMPLETED
    : isBuyer
      ? TRANSACTION_STATUS.CONFIRMED_BY_BUYER
      : TRANSACTION_STATUS.CONFIRMED_BY_SELLER;

  if (bothConfirmed) {
    await markSoldIfReserved(transaction.product);
  }

  let updated;
  try {
    updated = await Transaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: { $in: ACTIVE_TRANSACTION_STATUSES },
        buyerConfirmed: transaction.buyerConfirmed,
        sellerConfirmed: transaction.sellerConfirmed,
      },
      {
        $set: {
          buyerConfirmed: nextBuyerConfirmed,
          sellerConfirmed: nextSellerConfirmed,
          status: nextStatus,
          isActive: !bothConfirmed,
          ...(bothConfirmed ? { completedAt: new Date() } : {}),
        },
      },
      { new: true }
    );
  } catch (error) {
    updated = null;
    if (bothConfirmed) {
      await Product.updateOne(
        { _id: transaction.product, status: PRODUCT_STATUS.SOLD },
        { $set: { status: PRODUCT_STATUS.RESERVED } }
      );
    }
    throw error;
  }

  if (!updated) {
    if (bothConfirmed) {
      await Product.updateOne(
        { _id: transaction.product, status: PRODUCT_STATUS.SOLD },
        { $set: { status: PRODUCT_STATUS.RESERVED } }
      );
    }
    throw new TransactionError(409, 'This transaction changed before the confirmation was saved.');
  }

  transaction.buyerConfirmed = updated.buyerConfirmed;
  transaction.sellerConfirmed = updated.sellerConfirmed;
  transaction.status = updated.status;
  transaction.completedAt = updated.completedAt;
  transaction.isActive = updated.isActive;

  if (bothConfirmed) {
    const payload = {
      type: NOTIFICATION_TYPES.TRANSACTION_COMPLETED,
      title: 'Transaction completed',
      message: 'The transaction is complete and the product is now sold.',
      link: `/transactions/${transaction._id}`,
      relatedProduct: transaction.product,
    };
    await Promise.all([
      notifyQuietly({ ...payload, recipient: transaction.buyer, relatedUser: transaction.seller }),
      notifyQuietly({ ...payload, recipient: transaction.seller, relatedUser: transaction.buyer }),
    ]);
  } else {
    const recipient = isBuyer ? transaction.seller : transaction.buyer;
    const relatedUser = isBuyer ? transaction.buyer : transaction.seller;
    await notifyQuietly({
      recipient,
      relatedUser,
      type: NOTIFICATION_TYPES.TRANSACTION_CONFIRMED,
      title: 'Transaction confirmed',
      message: 'The other party confirmed this transaction.',
      link: `/transactions/${transaction._id}`,
      relatedProduct: transaction.product,
    });
  }

  return transaction;
};

export const cancelTransactionRecord = async (transactionId, actor, reason) => {
  if (reason !== undefined && reason !== null && reason !== '' && typeof reason !== 'string') {
    throw new TransactionError(400, 'Cancellation reason must be plain text.');
  }
  const cancellationReason = typeof reason === 'string' ? reason.trim() : '';
  if (cancellationReason.length > MAX_CANCELLATION_REASON) {
    throw new TransactionError(400, `Cancellation reason cannot exceed ${MAX_CANCELLATION_REASON} characters.`);
  }

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new TransactionError(404, 'Transaction not found.');
  }
  const { isBuyer } = assertParty(transaction, actor);

  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    throw new TransactionError(409, 'A completed transaction cannot be cancelled.');
  }
  if (transaction.status === TRANSACTION_STATUS.CANCELLED) {
    throw new TransactionError(409, 'This transaction is already cancelled.');
  }
  if (!isActiveStatus(transaction.status)) {
    throw new TransactionError(409, 'This transaction cannot be cancelled.');
  }

  const cancelledAt = new Date();
  const updated = await Transaction.findOneAndUpdate(
    {
      _id: transaction._id,
      status: { $in: ACTIVE_TRANSACTION_STATUSES },
    },
    {
      $set: {
        status: TRANSACTION_STATUS.CANCELLED,
        cancelledAt,
        cancellationReason,
        isActive: false,
      },
    },
    { new: true }
  );
  if (!updated) {
    throw new TransactionError(409, 'This transaction can no longer be cancelled.');
  }
  transaction.status = updated.status;
  transaction.cancelledAt = updated.cancelledAt;
  transaction.cancellationReason = updated.cancellationReason;
  transaction.isActive = false;
  await releaseProductIfIdle(transaction.product);

  const recipient = isBuyer ? transaction.seller : transaction.buyer;
  const relatedUser = isBuyer ? transaction.buyer : transaction.seller;
  await notifyQuietly({
    recipient,
    relatedUser,
    type: NOTIFICATION_TYPES.TRANSACTION_CANCELLED,
    title: 'Transaction cancelled',
    message: 'The transaction was cancelled.',
    link: `/transactions/${transaction._id}`,
    relatedProduct: transaction.product,
  });

  return transaction;
};
