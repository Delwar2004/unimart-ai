import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { BuyRequest } from '../models/BuyRequest.js';
import { Offer } from '../models/Offer.js';
import { Notification } from '../models/Notification.js';
import { Transaction } from '../models/Transaction.js';
import { createTransactionFromBuyRequest } from '../services/transactionService.js';
import { generateToken } from '../utils/token.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5000/api/v1';
const results = [];

const record = (id, name, ok) => {
  results.push({ id, name, ok: Boolean(ok) });
  console.log(`Test ${id} (${name}): ${ok ? 'PASS' : 'FAIL'}`);
};

const runCase = async (id, name, fn) => {
  try {
    const ok = await fn();
    record(id, name, ok);
  } catch (error) {
    console.error(`Test ${id} threw:`, error);
    record(id, name, false);
  }
};

const authHeaders = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const runRegression = (scriptName) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd: path.resolve(__dirname, '../..'),
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      const fails = (output.match(/: false\b/g) || []).length;
      const failedSummary = /Failed: (?!0\b)/.test(output);
      resolve({ code, fails, ok: code === 0 && fails === 0 && !failedSummary });
    });
  });

const clearNotificationValidator = async () => {
  if (mongoose.connection.readyState !== 1) return;
  await mongoose.connection.db.command({
    collMod: 'notifications',
    validator: { $jsonSchema: { bsonType: 'object' } },
    validationLevel: 'off',
  });
};

const runPhase9Validation = async () => {
  console.log('--- STARTING PHASE 9 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  await Transaction.syncIndexes();

  const emails = [
    'phase9_a@bup.edu.bd',
    'phase9_b@bup.edu.bd',
    'phase9_c@bup.edu.bd',
    'phase9_unverified@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    await Transaction.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await BuyRequest.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await Offer.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await Product.deleteMany({ seller: { $in: existingIds } });
    await User.deleteMany({ _id: { $in: existingIds } });
  }

  const category = await Category.findOne();
  if (!category) {
    throw new Error('No categories found. Start the API once so category seed can run.');
  }

  const makeUser = (name, email, studentId, isVerified) =>
    User.create({
      name,
      email,
      passwordHash: 'dummy_hash',
      studentId,
      phone: '+8801700000000',
      department: 'ICT',
      batch: 'BICE-24',
      campusLocation: 'Mirpur Cantonment Campus',
      role: 'student',
      isVerified,
      status: 'active',
    });

  const userA = await makeUser('Phase9 Student A', emails[0], 'phase9-a', true);
  const userB = await makeUser('Phase9 Student B', emails[1], 'phase9-b', true);
  const userC = await makeUser('Phase9 Student C', emails[2], 'phase9-c', true);
  const unverified = await makeUser('Phase9 Unverified', emails[3], 'phase9-unverified', false);

  const tokenA = generateToken(userA._id, 'student');
  const tokenB = generateToken(userB._id, 'student');
  const tokenC = generateToken(userC._id, 'student');

  const makeProduct = (title, price = 2500) =>
    Product.create({
      title,
      description: 'Phase 9 listing for transaction records.',
      category: category._id,
      seller: userB._id,
      listingType: 'sell',
      price,
      condition: 'good',
      campusLocation: 'FST Lab 402',
      status: 'available',
      images: [{ url: '/uploads/phase9-item.jpg', isThumbnail: true }],
    });

  const requestProduct = await makeProduct('Phase 9 Request Lamp', 2500);
  const offerProduct = await makeProduct('Phase 9 Offer Calculator', 3000);
  const dupProduct = await makeProduct('Phase 9 Duplicate Desk', 1500);
  const unavailableProduct = await makeProduct('Phase 9 Unavailable Chair', 800);
  const cancelBuyerProduct = await makeProduct('Phase 9 Cancel Buyer Mug', 400);
  const cancelSellerProduct = await makeProduct('Phase 9 Cancel Seller Pen', 120);

  const postRequest = (token, body) =>
    fetch(`${BASE}/buy-requests`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });

  const postOffer = (token, body) =>
    fetch(`${BASE}/offers`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });

  const acceptRequest = (token, id, body) =>
    fetch(`${BASE}/buy-requests/${id}/accept`, {
      method: 'PATCH',
      headers: authHeaders(token, true),
      body: body ? JSON.stringify(body) : undefined,
    });

  const acceptOffer = (token, id, body) =>
    fetch(`${BASE}/offers/${id}/accept`, {
      method: 'PATCH',
      headers: authHeaders(token, true),
      body: body ? JSON.stringify(body) : undefined,
    });

  const mainRequestRes = await postRequest(tokenA, {
    productId: requestProduct._id.toString(),
    message: 'I can collect this today.',
  });
  const mainRequestData = await mainRequestRes.json();
  const mainRequestId = mainRequestData.data?._id;

  const extraRequestRes = await postRequest(tokenC, {
    productId: requestProduct._id.toString(),
    message: 'I am also interested.',
  });
  const extraRequestData = await extraRequestRes.json();
  const extraRequestId = extraRequestData.data?._id;

  const extraOfferRes = await postOffer(tokenC, {
    productId: requestProduct._id.toString(),
    amount: 2100,
    message: 'Would 2100 work?',
  });
  const extraOfferData = await extraOfferRes.json();
  const extraOfferId = extraOfferData.data?._id;

  const offerRes = await postOffer(tokenA, {
    productId: offerProduct._id.toString(),
    amount: 2200,
    message: 'I can pay 2200.',
  });
  const offerData = await offerRes.json();
  const offerId = offerData.data?._id;

  const dupRequestARes = await postRequest(tokenA, { productId: dupProduct._id.toString(), message: 'First request' });
  const dupRequestA = await dupRequestARes.json();
  const dupRequestCRes = await postRequest(tokenC, { productId: dupProduct._id.toString(), message: 'Second request' });
  const dupRequestC = await dupRequestCRes.json();

  const unavailableRequestRes = await postRequest(tokenA, {
    productId: unavailableProduct._id.toString(),
    message: 'Before it sells',
  });
  const unavailableRequest = await unavailableRequestRes.json();
  await Product.updateOne({ _id: unavailableProduct._id }, { $set: { status: 'sold' } });

  const cancelBuyerRequestRes = await postRequest(tokenA, {
    productId: cancelBuyerProduct._id.toString(),
    message: 'Buyer will cancel',
  });
  const cancelBuyerRequest = await cancelBuyerRequestRes.json();
  const cancelSellerRequestRes = await postRequest(tokenA, {
    productId: cancelSellerProduct._id.toString(),
    message: 'Seller will cancel',
  });
  const cancelSellerRequest = await cancelSellerRequestRes.json();

  let requestTransactionId = null;
  let firstConfirmStatus = null;
  let offerTransactionId = null;
  let buyerCancelId = null;
  let sellerCancelId = null;
  let buyerCancelResponse = null;

  await runCase(1, 'Transaction model loads', async () => {
    return Transaction.modelName === 'Transaction' && Boolean(Transaction.schema.path('agreedPrice'));
  });

  await runCase(2, 'Cannot create transaction without accepted request/offer', async () => {
    let blocked = false;
    try {
      await createTransactionFromBuyRequest(mainRequestId, userB);
    } catch (error) {
      blocked = error.statusCode === 409;
    }
    const count = await Transaction.countDocuments({ product: requestProduct._id });
    return blocked && count === 0 && Boolean(mainRequestId);
  });

  await runCase(3, 'Accepted Buy Request creates transaction', async () => {
    const res = await acceptRequest(tokenB, mainRequestId, {
      buyerId: userC._id.toString(),
      sellerId: userC._id.toString(),
      productId: offerProduct._id.toString(),
      agreedPrice: 1,
      status: 'COMPLETED',
    });
    const data = await res.json();
    requestTransactionId = data.meta?.transactionId;
    const stored = await Transaction.findById(requestTransactionId);
    const request = await BuyRequest.findById(mainRequestId);
    return (
      res.status === 200 &&
      data.data?.status === 'accepted' &&
      stored?.sourceType === 'BUY_REQUEST' &&
      stored.sourceRequest.toString() === mainRequestId &&
      stored.status === 'PENDING' &&
      request?.status === 'accepted'
    );
  });

  await runCase(4, 'Accepted Offer creates transaction', async () => {
    const res = await acceptOffer(tokenB, offerId, {
      buyerId: userC._id.toString(),
      sellerId: userA._id.toString(),
      productId: requestProduct._id.toString(),
      agreedPrice: 1,
      amount: 1,
      status: 'COMPLETED',
    });
    const data = await res.json();
    offerTransactionId = data.meta?.transactionId;
    const stored = await Transaction.findById(offerTransactionId);
    const offer = await Offer.findById(offerId);
    return res.status === 200 && stored?.sourceType === 'OFFER' && stored.sourceOffer.toString() === offerId && offer?.status === 'accepted';
  });

  await runCase(5, 'Buyer derived server-side', async () => {
    const requestTxn = await Transaction.findById(requestTransactionId);
    const offerTxn = await Transaction.findById(offerTransactionId);
    return requestTxn.buyer.toString() === userA._id.toString() && offerTxn.buyer.toString() === userA._id.toString();
  });

  await runCase(6, 'Seller derived server-side', async () => {
    const requestTxn = await Transaction.findById(requestTransactionId);
    const offerTxn = await Transaction.findById(offerTransactionId);
    return requestTxn.seller.toString() === userB._id.toString() && offerTxn.seller.toString() === userB._id.toString();
  });

  await runCase(7, 'Product derived server-side', async () => {
    const requestTxn = await Transaction.findById(requestTransactionId);
    const offerTxn = await Transaction.findById(offerTransactionId);
    return requestTxn.product.toString() === requestProduct._id.toString() && offerTxn.product.toString() === offerProduct._id.toString();
  });

  await runCase(8, 'Buy Request price uses product price', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.agreedPrice === 2500;
  });

  await runCase(9, 'Offer price uses accepted offer amount', async () => {
    const stored = await Transaction.findById(offerTransactionId);
    return stored.agreedPrice === 2200;
  });

  await runCase(10, 'Duplicate active transaction prevented', async () => {
    const first = await acceptRequest(tokenB, dupRequestA.data?._id);
    const firstData = await first.json();
    const second = await acceptRequest(tokenB, dupRequestC.data?._id);
    let duplicateKey = false;
    try {
      await Transaction.create({
        product: dupProduct._id,
        buyer: userC._id,
        seller: userB._id,
        sourceType: 'BUY_REQUEST',
        agreedPrice: 1500,
        status: 'PENDING',
        isActive: true,
      });
    } catch (error) {
      duplicateKey = error?.code === 11000;
    }
    const activeCount = await Transaction.countDocuments({
      product: dupProduct._id,
      status: { $in: ['PENDING', 'CONFIRMED_BY_BUYER', 'CONFIRMED_BY_SELLER'] },
    });
    return first.status === 200 && Boolean(firstData.meta?.transactionId) && second.status === 409 && duplicateKey && activeCount === 1;
  });

  await runCase(11, 'Unavailable product rejected', async () => {
    const res = await acceptRequest(tokenB, unavailableRequest.data?._id);
    const count = await Transaction.countDocuments({ product: unavailableProduct._id });
    const request = await BuyRequest.findById(unavailableRequest.data?._id);
    return res.status === 409 && count === 0 && request?.status === 'pending';
  });

  await runCase(12, 'Transaction creation changes available to reserved', async () => {
    const product = await Product.findById(requestProduct._id);
    return product?.status === 'reserved';
  });

  await runCase(13, 'New requests rejected for reserved product', async () => {
    const res = await postRequest(tokenC, { productId: requestProduct._id.toString(), message: 'Too late' });
    const count = await BuyRequest.countDocuments({ product: requestProduct._id, status: 'pending' });
    return res.status === 400 && count === 0;
  });

  await runCase(14, 'New offers rejected for reserved product', async () => {
    const res = await postOffer(tokenA, { productId: offerProduct._id.toString(), amount: 1000 });
    const count = await Offer.countDocuments({ product: offerProduct._id, status: 'pending' });
    return res.status === 400 && count === 0;
  });

  await runCase(15, 'Completion changes reserved to sold', async () => {
    const buyer = await fetch(`${BASE}/transactions/${requestTransactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ status: 'CANCELLED', buyerId: userC._id.toString(), agreedPrice: 5 }),
    });
    const buyerData = await buyer.json();
    firstConfirmStatus = buyerData.data?.status;
    const reserved = await Product.findById(requestProduct._id);
    const seller = await fetch(`${BASE}/transactions/${requestTransactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const product = await Product.findById(requestProduct._id);
    const stored = await Transaction.findById(requestTransactionId);
    return (
      buyer.status === 200 &&
      firstConfirmStatus === 'CONFIRMED_BY_BUYER' &&
      reserved?.status === 'reserved' &&
      seller.status === 200 &&
      product?.status === 'sold' &&
      stored.status === 'COMPLETED'
    );
  });

  await runCase(16, 'Cancellation changes reserved to available when safe', async () => {
    const opened = await acceptRequest(tokenB, cancelBuyerRequest.data?._id);
    const openedData = await opened.json();
    buyerCancelId = openedData.meta?.transactionId;
    const reserved = await Product.findById(cancelBuyerProduct._id);
    buyerCancelResponse = await fetch(`${BASE}/transactions/${buyerCancelId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ cancellationReason: 'Plans changed' }),
    });
    const product = await Product.findById(cancelBuyerProduct._id);
    return opened.status === 200 && reserved?.status === 'reserved' && buyerCancelResponse.status === 200 && product?.status === 'available';
  });

  await runCase(17, 'Buyer can confirm', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.buyerConfirmed === true;
  });

  await runCase(18, 'Seller can confirm', async () => {
    const res = await fetch(`${BASE}/transactions/${offerTransactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenB, true),
      body: JSON.stringify({ status: 'COMPLETED', sellerId: userA._id.toString() }),
    });
    const data = await res.json();
    return res.status === 200 && data.data?.sellerConfirmed === true && data.data?.status === 'CONFIRMED_BY_SELLER';
  });

  await runCase(19, 'First confirmation changes status correctly', async () => {
    const offerTxn = await Transaction.findById(offerTransactionId);
    return firstConfirmStatus === 'CONFIRMED_BY_BUYER' && offerTxn.status === 'CONFIRMED_BY_SELLER';
  });

  await runCase(20, 'Second confirmation completes transaction', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.status === 'COMPLETED' && stored.buyerConfirmed === true && stored.sellerConfirmed === true;
  });

  await runCase(21, 'completedAt is set', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.completedAt instanceof Date && !Number.isNaN(stored.completedAt.getTime());
  });

  await runCase(22, 'Completed transaction cannot be confirmed again', async () => {
    const res = await fetch(`${BASE}/transactions/${requestTransactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const stored = await Transaction.findById(requestTransactionId);
    return res.status === 409 && stored.status === 'COMPLETED';
  });

  await runCase(23, 'Buyer can cancel active transaction', async () => {
    const data = await buyerCancelResponse.json();
    const stored = await Transaction.findById(buyerCancelId);
    return buyerCancelResponse.status === 200 && data.data?.status === 'CANCELLED' && stored.buyer.toString() === userA._id.toString();
  });

  await runCase(24, 'Seller can cancel active transaction', async () => {
    const opened = await acceptRequest(tokenB, cancelSellerRequest.data?._id);
    const openedData = await opened.json();
    sellerCancelId = openedData.meta?.transactionId;
    const res = await fetch(`${BASE}/transactions/${sellerCancelId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenB, true),
      body: JSON.stringify({ cancellationReason: 'Item is no longer for sale' }),
    });
    const stored = await Transaction.findById(sellerCancelId);
    const product = await Product.findById(cancelSellerProduct._id);
    return res.status === 200 && stored.status === 'CANCELLED' && product?.status === 'available';
  });

  await runCase(25, 'Cancellation reason stored', async () => {
    const buyerTxn = await Transaction.findById(buyerCancelId);
    const sellerTxn = await Transaction.findById(sellerCancelId);
    return buyerTxn.cancellationReason === 'Plans changed' && sellerTxn.cancellationReason === 'Item is no longer for sale';
  });

  await runCase(26, 'Cancelled transaction cannot be confirmed', async () => {
    const res = await fetch(`${BASE}/transactions/${buyerCancelId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const stored = await Transaction.findById(buyerCancelId);
    return res.status === 409 && stored.status === 'CANCELLED';
  });

  await runCase(27, 'Completed transaction cannot be cancelled', async () => {
    const res = await fetch(`${BASE}/transactions/${requestTransactionId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenB, true),
      body: JSON.stringify({ cancellationReason: 'Too late' }),
    });
    const stored = await Transaction.findById(requestTransactionId);
    return res.status === 409 && stored.status === 'COMPLETED' && !stored.cancellationReason;
  });

  await runCase(28, 'Already cancelled transaction cannot be cancelled again', async () => {
    const res = await fetch(`${BASE}/transactions/${buyerCancelId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenB, true),
      body: JSON.stringify({ cancellationReason: 'Again' }),
    });
    const stored = await Transaction.findById(buyerCancelId);
    return res.status === 409 && stored.cancellationReason === 'Plans changed';
  });

  await runCase(29, 'Unauthorized user cannot view transaction', async () => {
    const byId = await fetch(`${BASE}/transactions/${requestTransactionId}`, { headers: authHeaders(tokenC) });
    const list = await fetch(`${BASE}/transactions`, { headers: authHeaders(tokenC) });
    const listData = await list.json();
    const leaked = (listData.data?.transactions || []).some((item) => item._id === requestTransactionId);
    const missing = await fetch(`${BASE}/transactions/${new mongoose.Types.ObjectId().toString()}`, { headers: authHeaders(tokenA) });
    return byId.status === 403 && list.status === 200 && !leaked && missing.status === 404;
  });

  await runCase(30, 'Unauthorized user cannot confirm', async () => {
    const res = await fetch(`${BASE}/transactions/${offerTransactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenC),
    });
    const stored = await Transaction.findById(offerTransactionId);
    return res.status === 403 && stored.status === 'CONFIRMED_BY_SELLER' && stored.buyerConfirmed === false;
  });

  await runCase(31, 'Unauthorized user cannot cancel', async () => {
    const res = await fetch(`${BASE}/transactions/${offerTransactionId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenC, true),
      body: JSON.stringify({ cancellationReason: 'Not my deal' }),
    });
    const stored = await Transaction.findById(offerTransactionId);
    return res.status === 403 && stored.status === 'CONFIRMED_BY_SELLER';
  });

  await runCase(32, 'Client cannot change buyer', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.buyer.toString() === userA._id.toString() && stored.buyer.toString() !== userC._id.toString();
  });

  await runCase(33, 'Client cannot change seller', async () => {
    const stored = await Transaction.findById(requestTransactionId);
    return stored.seller.toString() === userB._id.toString();
  });

  await runCase(34, 'Client cannot change price', async () => {
    const requestTxn = await Transaction.findById(requestTransactionId);
    const offerTxn = await Transaction.findById(offerTransactionId);
    return requestTxn.agreedPrice === 2500 && offerTxn.agreedPrice === 2200;
  });

  await runCase(35, 'Client cannot change product', async () => {
    const direct = await fetch(`${BASE}/transactions`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({
        buyerId: userA._id.toString(),
        sellerId: userB._id.toString(),
        productId: dupProduct._id.toString(),
        amount: 10,
      }),
    });
    const stored = await Transaction.findById(requestTransactionId);
    return direct.status === 404 && stored.product.toString() === requestProduct._id.toString();
  });

  await runCase(36, 'Client cannot directly set status', async () => {
    const stored = await Transaction.findById(offerTransactionId);
    const injected = await fetch(`${BASE}/transactions?status[$ne]=PENDING`, { headers: authHeaders(tokenA) });
    return stored.status === 'CONFIRMED_BY_SELLER' && injected.status === 400;
  });

  await runCase(37, 'Invalid ObjectId handled safely', async () => {
    const read = await fetch(`${BASE}/transactions/not-an-id`, { headers: authHeaders(tokenA) });
    const confirm = await fetch(`${BASE}/transactions/not-an-id/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const cancel = await fetch(`${BASE}/transactions/not-an-id/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ cancellationReason: { $gt: '' } }),
    });
    const longReason = await fetch(`${BASE}/transactions/${offerTransactionId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ cancellationReason: 'x'.repeat(501) }),
    });
    const offerTxn = await Transaction.findById(offerTransactionId);
    return read.status === 400 && confirm.status === 400 && cancel.status === 400 && longReason.status === 400 && offerTxn.status === 'CONFIRMED_BY_SELLER';
  });

  await runCase(38, 'Transaction notification created', async () => {
    const notes = await Notification.find({
      type: 'TRANSACTION_CREATED',
      relatedProduct: requestProduct._id,
    });
    const recipients = notes.map((note) => note.recipient.toString()).sort();
    const expected = [userA._id.toString(), userB._id.toString()].sort();
    return notes.length >= 2 && recipients.join() === expected.join() && notes.every((note) => note.link === `/transactions/${requestTransactionId}`);
  });

  await runCase(39, 'Confirmation notification created', async () => {
    const note = await Notification.findOne({
      type: 'TRANSACTION_CONFIRMED',
      recipient: userB._id,
      relatedProduct: requestProduct._id,
    });
    return note?.title === 'Transaction confirmed' && note.link === `/transactions/${requestTransactionId}`;
  });

  await runCase(40, 'Completion notification created', async () => {
    const notes = await Notification.find({
      type: 'TRANSACTION_COMPLETED',
      relatedProduct: requestProduct._id,
    });
    const recipients = notes.map((note) => note.recipient.toString()).sort();
    const expected = [userA._id.toString(), userB._id.toString()].sort();
    return notes.length >= 2 && recipients.join() === expected.join();
  });

  await runCase(41, 'Cancellation notification created', async () => {
    const note = await Notification.findOne({
      type: 'TRANSACTION_CANCELLED',
      recipient: userB._id,
      relatedProduct: cancelBuyerProduct._id,
    });
    return note?.title === 'Transaction cancelled' && note.link === `/transactions/${buyerCancelId}`;
  });

  await runCase(42, 'Other pending requests/offers become non-actionable', async () => {
    const request = await BuyRequest.findById(extraRequestId);
    const offer = await Offer.findById(extraOfferId);
    const requestNote = await Notification.findOne({
      type: 'BUY_REQUEST_REJECTED',
      recipient: userC._id,
      relatedProduct: requestProduct._id,
    });
    const offerNote = await Notification.findOne({
      type: 'OFFER_REJECTED',
      recipient: userC._id,
      relatedProduct: requestProduct._id,
    });
    const acceptRejected = await acceptRequest(tokenB, extraRequestId);
    return (
      request?.status === 'rejected' &&
      offer?.status === 'rejected' &&
      requestNote?.message === 'Product is now reserved by another transaction.' &&
      offerNote?.message === 'Product is now reserved by another transaction.' &&
      acceptRejected.status === 409
    );
  });

  await runCase(43, 'Original Buy Request remains as historical record', async () => {
    const request = await BuyRequest.findById(mainRequestId);
    const txn = await Transaction.findById(requestTransactionId);
    return request?.status === 'accepted' && txn.sourceRequest.toString() === request._id.toString();
  });

  await runCase(44, 'Original Offer remains as historical record', async () => {
    const offer = await Offer.findById(offerId);
    const txn = await Transaction.findById(offerTransactionId);
    return offer?.status === 'accepted' && txn.sourceOffer.toString() === offer._id.toString();
  });

  await runCase(45, 'Health', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    const list = await fetch(`${BASE}/transactions?page=1&limit=100`, { headers: authHeaders(tokenA) });
    const listData = await list.json();
    const detail = await fetch(`${BASE}/transactions/${requestTransactionId}`, { headers: authHeaders(tokenA) });
    const detailData = await detail.json();
    const serialized = JSON.stringify(detailData.data || {});
    const privateLeak = ['passwordHash', 'verificationToken', emails[0], '+8801700000000'].some((value) => serialized.includes(value));
    const newestFirst = (listData.data?.transactions || []).every((item, index, items) => {
      if (index === 0) return true;
      return new Date(items[index - 1].createdAt).getTime() >= new Date(item.createdAt).getTime();
    });
    return (
      res.status === 200 &&
      data.success === true &&
      data.data?.database?.connected === true &&
      list.status === 200 &&
      listData.data?.pagination?.limit === 50 &&
      newestFirst &&
      detail.status === 200 &&
      !privateLeak &&
      !unverified.isVerified
    );
  });

  await mongoose.disconnect();

  const phase2 = await runRegression('phase2Validation.js');
  record(46, 'Phase 2', phase2.ok);
  const phase3 = await runRegression('phase3Validation.js');
  record(47, 'Phase 3', phase3.ok);
  const phase4 = await runRegression('phase4Validation.js');
  record(48, 'Phase 4', phase4.ok);
  const phase5 = await runRegression('phase5Validation.js');
  record(49, 'Phase 5', phase5.ok);
  const phase6 = await runRegression('phase6Validation.js');
  record(50, 'Phase 6', phase6.ok);
  const phase7 = await runRegression('phase7Validation.js');
  record(51, 'Phase 7', phase7.ok);
  const phase8 = await runRegression('phase8Validation.js');
  record(52, 'Phase 8', phase8.ok);

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 9 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed tests: ${failed.map((item) => `${item.id} ${item.name}`).join('; ')}`);
  }
  console.log(failed.length ? '--- PHASE 9 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 9 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase9Validation().catch(async (error) => {
  console.error('Phase 9 test suite failed:', error);
  try {
    await clearNotificationValidator();
  } catch {
    // Best-effort validator cleanup.
  }
  process.exit(1);
});
