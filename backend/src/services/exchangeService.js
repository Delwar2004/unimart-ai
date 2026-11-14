import { ExchangeRequest } from '../models/ExchangeRequest.js';
import { ExchangeTransaction, MAX_EXCHANGE_CANCELLATION_REASON } from '../models/ExchangeTransaction.js';
import { Product } from '../models/Product.js';
import {
  ACTIVE_EXCHANGE_STATUSES,
  EXCHANGE_TRANSACTION_STATUS,
  LISTING_TYPES,
  NOTIFICATION_TYPES,
  PRODUCT_STATUS,
  REQUEST_STATUS,
} from '../constants/index.js';
import { createNotification } from './notificationService.js';
import {
  markReservedProductSold,
  releaseReservedProductIfIdle,
  reserveAvailableProduct,
  TransactionError,
} from './transactionService.js';

const notifyQuietly = (payload) => createNotification(payload);

const sameId = (left, right) => {
  if (!left || !right) return false;
  const leftId = left._id || left;
  const rightId = right._id || right;
  return leftId.toString() === rightId.toString();
};

const idOf = (value) => value?._id || value;

const assertVerified = (actor) => {
  if (!actor?._id) throw new TransactionError(401, 'Authentication is required.');
  if (!actor.isVerified) {
    throw new TransactionError(403, 'You must verify your university email before managing an exchange.');
  }
};

const releaseBoth = async (productIds) => {
  for (const productId of productIds) {
    await releaseReservedProductIfIdle(productId);
  }
};

const rejectOtherExchanges = async (productIds, keepId) => {
  const filter = {
    status: REQUEST_STATUS.PENDING,
    $or: [
      { requestedProduct: { $in: productIds } },
      { offeredProduct: { $in: productIds } },
    ],
  };
  if (keepId) filter._id = { $ne: keepId };
  const requests = await ExchangeRequest.find(filter).select('_id proposer requestedProduct');
  if (!requests.length) return;
  await ExchangeRequest.updateMany(filter, { $set: { status: REQUEST_STATUS.REJECTED } });
  await Promise.all(
    requests.map((request) =>
      notifyQuietly({
        recipient: request.proposer,
        type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_REJECTED,
        title: 'Exchange request rejected',
        message: 'One of the products is now reserved by another exchange.',
        link: `/exchange-requests/${request._id}`,
        relatedProduct: request.requestedProduct,
      })
    )
  );
};

export const openExchangeFromRequest = async (requestId, actor, options = {}) => {
  assertVerified(actor);
  const request = await ExchangeRequest.findById(requestId);
  if (!request) throw new TransactionError(404, 'Exchange request not found.');
  if (!sameId(request.owner, actor._id)) {
    throw new TransactionError(403, 'Only the requested product owner can open this exchange.');
  }

  const existing = await ExchangeTransaction.findOne({ exchangeRequest: request._id });
  if (existing) {
    if (options.acceptPending && request.status === REQUEST_STATUS.PENDING) {
      request.status = REQUEST_STATUS.ACCEPTED;
      await request.save();
    }
    return existing;
  }

  if (request.status === REQUEST_STATUS.PENDING) {
    if (!options.acceptPending) {
      throw new TransactionError(409, 'The exchange request must be accepted before it can proceed.');
    }
  } else if (request.status !== REQUEST_STATUS.ACCEPTED) {
    throw new TransactionError(409, 'Only an accepted exchange request can start an exchange.');
  }

  const [requestedProduct, offeredProduct] = await Promise.all([
    Product.findById(request.requestedProduct),
    Product.findById(request.offeredProduct),
  ]);
  if (!requestedProduct || !offeredProduct) {
    throw new TransactionError(404, 'One of the exchange listings no longer exists.');
  }
  if (requestedProduct.listingType !== LISTING_TYPES.EXCHANGE || offeredProduct.listingType !== LISTING_TYPES.EXCHANGE) {
    throw new TransactionError(400, 'Both listings must be exchange listings.');
  }
  if (!sameId(offeredProduct.seller, request.proposer) || !sameId(requestedProduct.seller, request.owner)) {
    throw new TransactionError(409, 'The exchange parties no longer match these listings.');
  }
  if (requestedProduct.status !== PRODUCT_STATUS.AVAILABLE || offeredProduct.status !== PRODUCT_STATUS.AVAILABLE) {
    throw new TransactionError(409, 'Both products must still be available.');
  }

  const previousStatus = request.status;
  const reserved = [];
  let created = null;
  try {
    await reserveAvailableProduct(requestedProduct._id);
    reserved.push(requestedProduct._id);
    await reserveAvailableProduct(offeredProduct._id);
    reserved.push(offeredProduct._id);
    created = await ExchangeTransaction.create({
      exchangeRequest: request._id,
      requestedProduct: requestedProduct._id,
      offeredProduct: offeredProduct._id,
      products: [requestedProduct._id, offeredProduct._id],
      proposer: request.proposer,
      owner: request.owner,
      status: EXCHANGE_TRANSACTION_STATUS.PENDING,
      isActive: true,
    });
    if (request.status !== REQUEST_STATUS.ACCEPTED) {
      request.status = REQUEST_STATUS.ACCEPTED;
      await request.save();
    }
    await rejectOtherExchanges([requestedProduct._id, offeredProduct._id], request._id);
    return created;
  } catch (error) {
    if (created?._id) await ExchangeTransaction.deleteOne({ _id: created._id });
    if (request.status !== previousStatus) {
      request.status = previousStatus;
      await request.save();
    }
    await releaseBoth(reserved);
    if (error?.code === 11000) {
      throw new TransactionError(409, 'One of these products already has an active exchange.');
    }
    throw error;
  }
};

const loadExchange = async (transactionId) => {
  const transaction = await ExchangeTransaction.findById(transactionId);
  if (!transaction) throw new TransactionError(404, 'Exchange transaction not found.');
  return transaction;
};

const assertExchangeParty = (transaction, actor) => {
  assertVerified(actor);
  const isProposer = sameId(transaction.proposer, actor._id);
  const isOwner = sameId(transaction.owner, actor._id);
  if (!isProposer && !isOwner) {
    throw new TransactionError(403, 'You are not allowed to access this exchange.');
  }
  return { isProposer, isOwner };
};

export const confirmExchangeRecord = async (transactionId, actor) => {
  const transaction = await loadExchange(transactionId);
  const { isProposer, isOwner } = assertExchangeParty(transaction, actor);
  if (transaction.status === EXCHANGE_TRANSACTION_STATUS.CANCELLED) {
    throw new TransactionError(409, 'A cancelled exchange cannot be confirmed.');
  }
  if (transaction.status === EXCHANGE_TRANSACTION_STATUS.COMPLETED) {
    throw new TransactionError(409, 'A completed exchange cannot be confirmed again.');
  }
  if (!ACTIVE_EXCHANGE_STATUSES.includes(transaction.status)) {
    throw new TransactionError(409, 'This exchange cannot be confirmed.');
  }
  if (isProposer && transaction.proposerConfirmed) {
    throw new TransactionError(409, 'You have already confirmed this exchange.');
  }
  if (isOwner && transaction.ownerConfirmed) {
    throw new TransactionError(409, 'You have already confirmed this exchange.');
  }

  const nextProposer = isProposer ? true : transaction.proposerConfirmed;
  const nextOwner = isOwner ? true : transaction.ownerConfirmed;
  const both = nextProposer && nextOwner;
  const nextStatus = both
    ? EXCHANGE_TRANSACTION_STATUS.COMPLETED
    : isProposer
      ? EXCHANGE_TRANSACTION_STATUS.CONFIRMED_BY_PROPOSER
      : EXCHANGE_TRANSACTION_STATUS.CONFIRMED_BY_OWNER;

  const sold = [];
  if (both) {
    try {
      await markReservedProductSold(transaction.requestedProduct);
      sold.push(transaction.requestedProduct);
      await markReservedProductSold(transaction.offeredProduct);
      sold.push(transaction.offeredProduct);
    } catch (error) {
      for (const productId of sold) {
        await Product.updateOne(
          { _id: productId, status: PRODUCT_STATUS.SOLD },
          { $set: { status: PRODUCT_STATUS.RESERVED } }
        );
      }
      throw error;
    }
  }

  const updated = await ExchangeTransaction.findOneAndUpdate(
    {
      _id: transaction._id,
      status: { $in: ACTIVE_EXCHANGE_STATUSES },
      proposerConfirmed: transaction.proposerConfirmed,
      ownerConfirmed: transaction.ownerConfirmed,
    },
    {
      $set: {
        proposerConfirmed: nextProposer,
        ownerConfirmed: nextOwner,
        status: nextStatus,
        isActive: !both,
        ...(both ? { completedAt: new Date() } : {}),
      },
    },
    { new: true }
  );

  if (!updated) {
    for (const productId of sold) {
      await Product.updateOne(
        { _id: productId, status: PRODUCT_STATUS.SOLD },
        { $set: { status: PRODUCT_STATUS.RESERVED } }
      );
    }
    throw new TransactionError(409, 'This exchange changed before the confirmation was saved.');
  }

  if (both) {
    const payload = {
      type: NOTIFICATION_TYPES.EXCHANGE_COMPLETED,
      title: 'Exchange completed',
      message: 'Both students confirmed the exchange. Both listings are now sold.',
      link: `/exchange-requests/${updated.exchangeRequest}`,
      relatedProduct: updated.requestedProduct,
    };
    await Promise.all([
      notifyQuietly({ ...payload, recipient: updated.proposer, relatedUser: updated.owner }),
      notifyQuietly({ ...payload, recipient: updated.owner, relatedUser: updated.proposer }),
    ]);
  } else {
    await notifyQuietly({
      recipient: isProposer ? updated.owner : updated.proposer,
      relatedUser: isProposer ? updated.proposer : updated.owner,
      type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_ACCEPTED,
      title: 'Exchange confirmed',
      message: 'The other student confirmed this exchange.',
      link: `/exchange-requests/${updated.exchangeRequest}`,
      relatedProduct: updated.requestedProduct,
    });
  }

  return updated;
};

export const cancelExchangeRecord = async (transactionId, actor, reason) => {
  if (reason !== undefined && reason !== null && reason !== '' && typeof reason !== 'string') {
    throw new TransactionError(400, 'Cancellation reason must be plain text.');
  }
  const cancellationReason = typeof reason === 'string' ? reason.trim() : '';
  if (cancellationReason.length > MAX_EXCHANGE_CANCELLATION_REASON) {
    throw new TransactionError(400, `Cancellation reason cannot exceed ${MAX_EXCHANGE_CANCELLATION_REASON} characters.`);
  }

  const transaction = await loadExchange(transactionId);
  const { isProposer } = assertExchangeParty(transaction, actor);
  if (transaction.status === EXCHANGE_TRANSACTION_STATUS.COMPLETED) {
    throw new TransactionError(409, 'A completed exchange cannot be cancelled.');
  }
  if (transaction.status === EXCHANGE_TRANSACTION_STATUS.CANCELLED) {
    throw new TransactionError(409, 'This exchange is already cancelled.');
  }
  if (!ACTIVE_EXCHANGE_STATUSES.includes(transaction.status)) {
    throw new TransactionError(409, 'This exchange cannot be cancelled.');
  }

  const updated = await ExchangeTransaction.findOneAndUpdate(
    { _id: transaction._id, status: { $in: ACTIVE_EXCHANGE_STATUSES } },
    {
      $set: {
        status: EXCHANGE_TRANSACTION_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason,
        isActive: false,
      },
    },
    { new: true }
  );
  if (!updated) throw new TransactionError(409, 'This exchange can no longer be cancelled.');

  await releaseBoth([updated.requestedProduct, updated.offeredProduct]);
  await notifyQuietly({
    recipient: isProposer ? updated.owner : updated.proposer,
    relatedUser: isProposer ? updated.proposer : updated.owner,
    type: NOTIFICATION_TYPES.EXCHANGE_CANCELLED,
    title: 'Exchange cancelled',
    message: 'The exchange was cancelled.',
    link: `/exchange-requests/${updated.exchangeRequest}`,
    relatedProduct: updated.requestedProduct,
  });
  return updated;
};

export const idOfExchange = idOf;
