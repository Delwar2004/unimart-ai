import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { Review } from '../models/Review.js';
import { Report } from '../models/Report.js';
import { WantedPost } from '../models/WantedPost.js';
import { Notification } from '../models/Notification.js';
import { generateToken } from '../utils/token.js';
import { refreshProductRating, refreshRevieweeReputation } from '../services/reviewService.js';

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
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

const runPhase11Validation = async () => {
  console.log('--- STARTING PHASE 11 AUTOMATED TEST SUITE ---');
  await runCase(1, 'Review model loads', async () => Review.modelName === 'Review' && Report.modelName === 'Report');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  await Promise.all([Review.syncIndexes(), Report.syncIndexes(), Transaction.syncIndexes(), ExchangeTransaction.syncIndexes()]);

  const emails = ['phase11_a@bup.edu.bd', 'phase11_b@bup.edu.bd', 'phase11_c@bup.edu.bd', 'phase11_unverified@bup.edu.bd'];
  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    await Review.deleteMany({ $or: [{ reviewer: { $in: existingIds } }, { reviewee: { $in: existingIds } }] });
    await Report.deleteMany({ reporter: { $in: existingIds } });
    await ExchangeTransaction.deleteMany({ $or: [{ proposer: { $in: existingIds } }, { owner: { $in: existingIds } }] });
    await Transaction.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await WantedPost.deleteMany({ author: { $in: existingIds } });
    await Product.deleteMany({ seller: { $in: existingIds } });
    await User.deleteMany({ _id: { $in: existingIds } });
  }

  const category = await Category.findOne();
  if (!category) throw new Error('No categories found. Start the API once so category seed can run.');

  const makeUser = (name, email, studentId, isVerified) =>
    User.create({
      name,
      email,
      passwordHash: 'dummy_hash',
      studentId,
      phone: '+8801700000011',
      department: 'ICT',
      batch: 'BICE-24',
      campusLocation: 'Mirpur Cantonment Campus',
      role: 'student',
      isVerified,
      status: 'active',
    });

  const userA = await makeUser('Phase11 Student A', emails[0], 'phase11-a', true);
  const userB = await makeUser('Phase11 Student B', emails[1], 'phase11-b', true);
  const userC = await makeUser('Phase11 Student C', emails[2], 'phase11-c', true);
  const tokenA = generateToken(userA._id, 'student');
  const tokenB = generateToken(userB._id, 'student');
  const tokenC = generateToken(userC._id, 'student');

  const makeProduct = (title, seller) =>
    Product.create({
      title,
      description: 'Phase 11 campus listing.',
      category: category._id,
      seller,
      listingType: 'sell',
      price: 500,
      condition: 'good',
      campusLocation: 'FST Lab 402',
      status: 'sold',
      images: [{ url: '/uploads/phase11-item.jpg', isThumbnail: true }],
    });

  const makeSale = (product, status, extra = {}) =>
    Transaction.create({
      product,
      buyer: userA._id,
      seller: userB._id,
      sourceType: extra.sourceType || 'BUY_REQUEST',
      agreedPrice: extra.agreedPrice ?? 500,
      status,
      buyerConfirmed: status === 'COMPLETED' || status === 'CONFIRMED_BY_BUYER',
      sellerConfirmed: status === 'COMPLETED' || status === 'CONFIRMED_BY_SELLER',
      completedAt: status === 'COMPLETED' ? new Date() : null,
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
      isActive: !['COMPLETED', 'CANCELLED'].includes(status),
      ...extra,
    });

  const confirmedSellerProduct = await makeProduct('Phase11 Confirmed Seller', userB._id);
  const pendingProduct = await makeProduct('Phase11 Pending', userB._id);
  const confirmedBuyerProduct = await makeProduct('Phase11 Confirmed Buyer', userB._id);
  const cancelledProduct = await makeProduct('Phase11 Cancelled', userB._id);
  const completedProduct = await makeProduct('Phase11 Completed Lamp', userB._id);
  const lowProduct = await makeProduct('Phase11 Low Rating', userB._id);
  const deleteProduct = await makeProduct('Phase11 Delete Review', userB._id);
  const giveawayProduct = await makeProduct('Phase11 Giveaway Coat', userB._id);
  const requested = await makeProduct('Phase11 Exchange Requested', userB._id);
  const offered = await makeProduct('Phase11 Exchange Offered', userA._id);
  const pendingRequested = await makeProduct('Phase11 Exchange Pending Requested', userB._id);
  const pendingOffered = await makeProduct('Phase11 Exchange Pending Offered', userA._id);

  const confirmedSellerTx = await makeSale(confirmedSellerProduct._id, 'CONFIRMED_BY_SELLER');
  const pendingTx = await makeSale(pendingProduct._id, 'PENDING');
  const confirmedBuyerTx = await makeSale(confirmedBuyerProduct._id, 'CONFIRMED_BY_BUYER');
  const cancelledTx = await makeSale(cancelledProduct._id, 'CANCELLED');
  const completedTx = await makeSale(completedProduct._id, 'COMPLETED');
  const lowTx = await makeSale(lowProduct._id, 'COMPLETED');
  const deleteTx = await makeSale(deleteProduct._id, 'COMPLETED');
  const giveawayTx = await makeSale(giveawayProduct._id, 'COMPLETED', {
    sourceType: 'GIVEAWAY_REQUEST',
    agreedPrice: 0,
  });
  const completedExchange = await ExchangeTransaction.create({
    exchangeRequest: new mongoose.Types.ObjectId(),
    requestedProduct: requested._id,
    offeredProduct: offered._id,
    products: [requested._id, offered._id],
    proposer: userA._id,
    owner: userB._id,
    status: 'COMPLETED',
    proposerConfirmed: true,
    ownerConfirmed: true,
    completedAt: new Date(),
    isActive: false,
  });
  const pendingExchange = await ExchangeTransaction.create({
    exchangeRequest: new mongoose.Types.ObjectId(),
    requestedProduct: pendingRequested._id,
    offeredProduct: pendingOffered._id,
    products: [pendingRequested._id, pendingOffered._id],
    proposer: userA._id,
    owner: userB._id,
    status: 'PENDING',
    isActive: true,
  });

  const postReview = (token, body) =>
    fetch(`${BASE}/reviews`, { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(body) });
  const postReport = (token, body) =>
    fetch(`${BASE}/reports`, { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(body) });

  const blocked = async (txId) => {
    const eligible = await fetch(`${BASE}/reviews/eligible/${txId}`, { headers: authHeaders(tokenA) });
    const body = await eligible.json();
    const created = await postReview(tokenA, { transactionId: txId, rating: 5, comment: 'Too early' });
    return eligible.status === 200 && body.data?.eligible === false && created.status === 403;
  };

  await runCase(2, 'Incomplete transaction cannot be reviewed', () => blocked(confirmedSellerTx._id.toString()));
  await runCase(3, 'Pending transaction cannot be reviewed', () => blocked(pendingTx._id.toString()));
  await runCase(4, 'Confirmed-but-not-completed transaction cannot be reviewed', () => blocked(confirmedBuyerTx._id.toString()));
  await runCase(5, 'Cancelled transaction cannot be reviewed', () => blocked(cancelledTx._id.toString()));

  await runCase(6, 'Completed buyer can review seller', async () => {
    const res = await fetch(`${BASE}/reviews/eligible/${completedTx._id}`, { headers: authHeaders(tokenA) });
    const body = await res.json();
    return res.status === 200 && body.data?.eligible === true && body.data?.type === 'BUYER_TO_SELLER';
  });
  await runCase(7, 'Completed seller can review buyer', async () => {
    const res = await fetch(`${BASE}/reviews/eligible/${completedTx._id}`, { headers: authHeaders(tokenB) });
    const body = await res.json();
    return res.status === 200 && body.data?.eligible === true && body.data?.type === 'SELLER_TO_BUYER';
  });
  await runCase(8, 'ExchangeTransaction completed participant can review participant', async () => {
    const res = await fetch(`${BASE}/reviews/eligible/${completedExchange._id}`, { headers: authHeaders(tokenA) });
    const body = await res.json();
    return res.status === 200 && body.data?.eligible === true && body.data?.type === 'BUYER_TO_SELLER';
  });
  await runCase(9, 'Completed giveaway transaction can be reviewed', async () => {
    const res = await fetch(`${BASE}/reviews/eligible/${giveawayTx._id}`, { headers: authHeaders(tokenA) });
    const body = await res.json();
    return res.status === 200 && body.data?.eligible === true && giveawayTx.agreedPrice === 0;
  });
  await runCase(10, 'Unrelated user cannot review transaction', async () => {
    const eligible = await fetch(`${BASE}/reviews/eligible/${completedTx._id}`, { headers: authHeaders(tokenC) });
    const body = await eligible.json();
    const created = await postReview(tokenC, { transactionId: completedTx._id.toString(), rating: 5 });
    return eligible.status === 200 && body.data?.eligible === false && created.status === 403;
  });

  await runCase(14, 'Rating below 1 rejected', async () => {
    const res = await postReview(tokenA, { transactionId: lowTx._id.toString(), rating: 0 });
    return res.status === 400;
  });
  await runCase(15, 'Rating above 5 rejected', async () => {
    const res = await postReview(tokenA, { transactionId: lowTx._id.toString(), rating: 6 });
    return res.status === 400;
  });
  await runCase(16, 'Non-integer rating rejected', async () => {
    const res = await postReview(tokenA, { transactionId: lowTx._id.toString(), rating: 4.5 });
    return res.status === 400;
  });
  await runCase(17, 'Comment length enforced', async () => {
    const res = await postReview(tokenA, { transactionId: lowTx._id.toString(), rating: 5, comment: 'x'.repeat(1001) });
    return res.status === 400;
  });

  let buyerReview;
  await runCase(11, 'Valid buyer-to-seller review', async () => {
    const res = await postReview(tokenA, {
      transactionId: completedTx._id.toString(),
      rating: 5,
      comment: 'Smooth transaction and helpful seller.',
      reviewer: userC._id.toString(),
      reviewee: userC._id.toString(),
      product: lowProduct._id.toString(),
      type: 'SELLER_TO_BUYER',
      transaction: lowTx._id.toString(),
      status: 'hidden',
    });
    const body = await res.json();
    buyerReview = body.data;
    return res.status === 201 && body.data?.rating === 5 && body.data?.type === 'BUYER_TO_SELLER';
  });

  let sellerReview;
  await runCase(12, 'Valid seller-to-buyer review', async () => {
    const res = await postReview(tokenB, {
      transactionId: completedTx._id.toString(),
      rating: 4,
      comment: 'Buyer was on time.',
    });
    const body = await res.json();
    sellerReview = body.data;
    return res.status === 201 && body.data?.type === 'SELLER_TO_BUYER' && body.data?.rating === 4;
  });

  let lowReview;
  await runCase(13, 'Rating 1-5 accepted', async () => {
    const res = await postReview(tokenA, { transactionId: lowTx._id.toString(), rating: 1, comment: 'Item differed from the description.' });
    const body = await res.json();
    lowReview = body.data;
    return res.status === 201 && body.data?.rating === 1 && buyerReview?.rating === 5;
  });

  await runCase(18, 'Reviewer derived from JWT', async () => buyerReview?.reviewer?._id === userA._id.toString());
  await runCase(19, 'Reviewee derived from transaction', async () => buyerReview?.reviewee?._id === userB._id.toString());
  await runCase(20, 'Product derived from transaction', async () => (buyerReview?.product?._id || buyerReview?.product) === completedProduct._id.toString());
  await runCase(21, 'Duplicate review prevented', async () => {
    const res = await postReview(tokenA, { transactionId: completedTx._id.toString(), rating: 5 });
    return res.status === 409;
  });
  await runCase(22, 'Client cannot change reviewer', async () => buyerReview?.reviewer?._id === userA._id.toString());
  await runCase(23, 'Client cannot change reviewee', async () => buyerReview?.reviewee?._id === userB._id.toString());
  await runCase(24, 'Client cannot change transaction', async () => String(buyerReview?.transaction) === completedTx._id.toString());
  await runCase(25, 'Client cannot change review type', async () => buyerReview?.type === 'BUYER_TO_SELLER' && buyerReview?.status === 'published');

  await runCase(26, 'Reviewer can edit own review', async () => {
    const res = await fetch(`${BASE}/reviews/${buyerReview._id}`, {
      method: 'PUT',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ rating: 1, comment: 'Updated after pickup.', type: 'SELLER_TO_BUYER', status: 'hidden' }),
    });
    const body = await res.json();
    buyerReview = body.data;
    return res.status === 200 && body.data?.rating === 1 && body.data?.type === 'BUYER_TO_SELLER' && body.data?.status === 'published';
  });
  await runCase(27, 'Reviewer cannot edit another user review', async () => {
    const res = await fetch(`${BASE}/reviews/${buyerReview._id}`, {
      method: 'PUT',
      headers: authHeaders(tokenC, true),
      body: JSON.stringify({ rating: 5 }),
    });
    return res.status === 403;
  });

  let deleteReviewId;
  await runCase(28, 'Reviewer can delete own review', async () => {
    const created = await postReview(tokenA, { transactionId: deleteTx._id.toString(), rating: 2, comment: 'Temporary' });
    const body = await created.json();
    deleteReviewId = body.data?._id;
    const res = await fetch(`${BASE}/reviews/${deleteReviewId}`, { method: 'DELETE', headers: authHeaders(tokenA) });
    const after = await Review.findById(deleteReviewId);
    return created.status === 201 && res.status === 200 && !after;
  });
  await runCase(29, 'Reviewer cannot delete another user review', async () => {
    const res = await fetch(`${BASE}/reviews/${buyerReview._id}`, { method: 'DELETE', headers: authHeaders(tokenB) });
    return res.status === 403;
  });
  await runCase(30, 'Edited rating updates aggregation', async () => {
    const product = await Product.findById(completedProduct._id);
    return product.averageRating === 2.5 && product.ratingCount === 2;
  });
  await runCase(31, 'Deleted review updates aggregation', async () => {
    const product = await Product.findById(deleteProduct._id);
    return product.ratingCount === 0 && product.averageRating === 0;
  });
  await runCase(32, 'Product average rating calculated correctly', async () => {
    const product = await Product.findById(completedProduct._id);
    return product.averageRating === 2.5;
  });
  await runCase(33, 'Product review count correct', async () => {
    const product = await Product.findById(completedProduct._id);
    const list = await fetch(`${BASE}/reviews/product/${completedProduct._id}`);
    const body = await list.json();
    return product.ratingCount === 2 && body.meta?.ratingCount === 2 && body.data?.length === 2;
  });
  await runCase(34, 'Seller average rating calculated correctly', async () => {
    const seller = await User.findById(userB._id);
    return seller.reputation.averageRating === 1 && seller.reputation.ratingsCount === 2;
  });
  await runCase(35, 'Seller review count correct', async () => {
    const seller = await User.findById(userB._id);
    const buyer = await User.findById(userA._id);
    return seller.reputation.ratingsCount === 2 && buyer.reputation.averageRating === 4 && buyer.reputation.ratingsCount === 1;
  });
  await runCase(36, 'Hidden reviews excluded from public aggregation', async () => {
    await Review.updateOne({ _id: sellerReview._id }, { status: 'hidden' });
    await refreshProductRating(completedProduct._id);
    await refreshRevieweeReputation(userA._id);
    const product = await Product.findById(completedProduct._id);
    const buyer = await User.findById(userA._id);
    const list = await fetch(`${BASE}/reviews/product/${completedProduct._id}`);
    const body = await list.json();
    const ids = (body.data || []).map((item) => item._id);
    return product.averageRating === 1 && product.ratingCount === 1 && buyer.reputation.ratingsCount === 0 && !ids.includes(sellerReview._id);
  });

  await runCase(37, 'Completed exchange can be reviewed', async () => {
    const res = await postReview(tokenA, { transactionId: completedExchange._id.toString(), rating: 5, comment: 'Fair exchange.' });
    const body = await res.json();
    return res.status === 201 && String(body.data?.exchangeTransaction) === completedExchange._id.toString() && body.data?.transaction == null;
  });
  await runCase(38, 'Incomplete exchange cannot be reviewed', async () => {
    const res = await postReview(tokenA, { transactionId: pendingExchange._id.toString(), rating: 5 });
    return res.status === 403;
  });
  await runCase(39, 'Both exchange participants can review each other', async () => {
    const res = await postReview(tokenB, { transactionId: completedExchange._id.toString(), rating: 4, comment: 'Good trade.' });
    const body = await res.json();
    const proposerReview = await Review.findOne({ exchangeTransaction: completedExchange._id, reviewer: userA._id });
    return res.status === 201 && body.data?.type === 'SELLER_TO_BUYER' && proposerReview?.type === 'BUYER_TO_SELLER';
  });
  await runCase(40, 'Completed giveaway can be reviewed', async () => {
    const res = await postReview(tokenA, { transactionId: giveawayTx._id.toString(), rating: 5, comment: 'Thanks for the giveaway.' });
    return res.status === 201;
  });
  await runCase(41, 'Giveaway with 0 BDT remains reviewable', async () => {
    const stored = await Transaction.findById(giveawayTx._id);
    const review = await Review.findOne({ transaction: giveawayTx._id, reviewer: userA._id });
    const sellerEligible = await fetch(`${BASE}/reviews/eligible/${giveawayTx._id}`, { headers: authHeaders(tokenB) });
    const body = await sellerEligible.json();
    return stored.agreedPrice === 0 && stored.sourceType === 'GIVEAWAY_REQUEST' && review && body.data?.eligible === true;
  });

  await runCase(42, 'Review creation sends REVIEW_RECEIVED notification', async () => {
    const note = await Notification.findOne({ recipient: userB._id, type: 'REVIEW_RECEIVED', relatedProduct: completedProduct._id });
    return Boolean(note) && note.title === 'New review received';
  });
  await runCase(43, 'Notification failure does not break review creation', async () => {
    await mongoose.connection.db.command({
      collMod: 'notifications',
      validator: { $jsonSchema: { bsonType: 'object', required: ['__phase11_force_fail'] } },
      validationLevel: 'strict',
      validationAction: 'error',
    });
    try {
      const res = await postReview(tokenB, { transactionId: giveawayTx._id.toString(), rating: 5, comment: 'Notification should not block this.' });
      return res.status === 201;
    } finally {
      await clearNotificationValidator();
    }
  });

  const wanted = await WantedPost.create({
    author: userB._id,
    title: 'Phase11 graphing calculator wanted',
    description: 'Looking for a working calculator.',
    status: 'active',
  });

  let productReport;
  await runCase(44, 'Valid product report', async () => {
    const res = await postReport(tokenA, {
      targetType: 'PRODUCT',
      targetId: completedProduct._id.toString(),
      reason: 'MISLEADING',
      description: 'The listing description does not match the item.',
      reporter: userC._id.toString(),
      status: 'RESOLVED',
    });
    const body = await res.json();
    productReport = body.data;
    return res.status === 201 && body.data?.status === 'PENDING' && body.data?.reason === 'MISLEADING';
  });
  let userReport;
  await runCase(45, 'Valid user report', async () => {
    const res = await postReport(tokenA, { targetType: 'USER', targetId: userB._id.toString(), reason: 'HARASSMENT', description: 'Rude messages after the handoff.' });
    const body = await res.json();
    userReport = body.data;
    return res.status === 201 && body.data?.targetType === 'USER';
  });
  let reviewReport;
  await runCase(46, 'Valid review report', async () => {
    const res = await postReport(tokenC, { targetType: 'REVIEW', targetId: buyerReview._id, reason: 'SPAM', description: 'Copied text.' });
    const body = await res.json();
    reviewReport = body.data;
    return res.status === 201 && body.data?.targetType === 'REVIEW';
  });
  await runCase(47, 'Valid wanted-post report', async () => {
    const res = await postReport(tokenA, { targetType: 'WANTED_POST', targetId: wanted._id.toString(), reason: 'SPAM', description: 'Repeated post.' });
    return res.status === 201;
  });
  await runCase(48, 'Unauthenticated report rejected', async () => {
    const res = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'PRODUCT', targetId: completedProduct._id.toString(), reason: 'SPAM' }),
    });
    return res.status === 401;
  });
  await runCase(49, 'Invalid target type rejected', async () => {
    const res = await postReport(tokenA, { targetType: 'ORDER', targetId: completedProduct._id.toString(), reason: 'SPAM' });
    return res.status === 400;
  });
  await runCase(50, 'Invalid target ID rejected', async () => {
    const res = await postReport(tokenA, { targetType: 'PRODUCT', targetId: 'not-an-id', reason: 'SPAM' });
    return res.status === 400;
  });
  await runCase(51, 'Invalid reason rejected', async () => {
    const res = await postReport(tokenA, { targetType: 'PRODUCT', targetId: lowProduct._id.toString(), reason: 'BORED' });
    return res.status === 400;
  });
  await runCase(52, 'Description length enforced', async () => {
    const res = await postReport(tokenA, { targetType: 'PRODUCT', targetId: lowProduct._id.toString(), reason: 'OTHER', description: 'y'.repeat(1001) });
    return res.status === 400;
  });
  await runCase(53, 'Reporter derived from JWT', async () => {
    const stored = await Report.findById(productReport._id);
    return stored.reporter.toString() === userA._id.toString();
  });
  await runCase(54, 'Client cannot set report status', async () => productReport?.status === 'PENDING');
  await runCase(55, 'User can retrieve own reports', async () => {
    const res = await fetch(`${BASE}/reports/my`, { headers: authHeaders(tokenA) });
    const body = await res.json();
    return res.status === 200 && (body.data || []).some((item) => item._id === productReport._id);
  });
  await runCase(56, 'User cannot retrieve another user report', async () => {
    const res = await fetch(`${BASE}/reports/${productReport._id}`, { headers: authHeaders(tokenB) });
    return res.status === 403;
  });
  await runCase(57, 'User can withdraw pending own report', async () => {
    const res = await fetch(`${BASE}/reports/${productReport._id}`, { method: 'DELETE', headers: authHeaders(tokenA) });
    const stored = await Report.findById(productReport._id);
    return res.status === 200 && !stored;
  });
  await runCase(58, 'User cannot withdraw another user report', async () => {
    const res = await fetch(`${BASE}/reports/${userReport._id}`, { method: 'DELETE', headers: authHeaders(tokenC) });
    const stored = await Report.findById(userReport._id);
    return res.status === 403 && stored?.status === 'PENDING';
  });
  await runCase(59, 'Resolved/reviewed report cannot be withdrawn', async () => {
    await Report.updateOne({ _id: reviewReport._id }, { status: 'REVIEWED' });
    const reviewed = await fetch(`${BASE}/reports/${reviewReport._id}`, { method: 'DELETE', headers: authHeaders(tokenC) });
    await Report.updateOne({ _id: reviewReport._id }, { status: 'RESOLVED' });
    const resolved = await fetch(`${BASE}/reports/${reviewReport._id}`, { method: 'DELETE', headers: authHeaders(tokenC) });
    return reviewed.status === 409 && resolved.status === 409;
  });
  await runCase(60, 'Duplicate active report prevented', async () => {
    const res = await postReport(tokenA, { targetType: 'USER', targetId: userB._id.toString(), reason: 'SPAM', description: 'Again' });
    return res.status === 409;
  });

  await runCase(61, 'IDOR review access blocked', async () => {
    const res = await fetch(`${BASE}/reviews/my`, { headers: authHeaders(tokenC) });
    const body = await res.json();
    return res.status === 200 && !(body.data || []).some((item) => item._id === buyerReview._id);
  });
  await runCase(62, 'IDOR review edit blocked', async () => {
    const res = await fetch(`${BASE}/reviews/${sellerReview._id}`, {
      method: 'PUT',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ rating: 1 }),
    });
    return res.status === 403;
  });
  await runCase(63, 'IDOR review delete blocked', async () => {
    const res = await fetch(`${BASE}/reviews/${lowReview._id}`, { method: 'DELETE', headers: authHeaders(tokenB) });
    return res.status === 403;
  });
  await runCase(64, 'IDOR report access blocked', async () => {
    const res = await fetch(`${BASE}/reports/${userReport._id}`, { headers: authHeaders(tokenB) });
    return res.status === 403;
  });
  await runCase(65, 'IDOR report delete blocked', async () => {
    const res = await fetch(`${BASE}/reports/${userReport._id}`, { method: 'DELETE', headers: authHeaders(tokenB) });
    return res.status === 403;
  });
  await runCase(66, 'MongoDB operator injection prevented', async () => {
    const before = await Review.countDocuments({ reviewer: userA._id });
    const review = await postReview(tokenA, { transactionId: { $ne: null }, rating: { $gt: 0 }, comment: { $ne: '' } });
    const report = await postReport(tokenA, { targetType: { $ne: '' }, targetId: { $gt: '' }, reason: { $ne: null }, description: { $gt: '' } });
    const after = await Review.countDocuments({ reviewer: userA._id });
    return review.status === 400 && report.status === 400 && after === before;
  });
  await runCase(67, 'Invalid ObjectIds handled safely', async () => {
    const review = await fetch(`${BASE}/reviews/eligible/not-an-id`, { headers: authHeaders(tokenA) });
    const product = await fetch(`${BASE}/reviews/product/not-an-id`);
    const report = await fetch(`${BASE}/reports/not-an-id`, { headers: authHeaders(tokenA) });
    return review.status === 400 && product.status === 400 && report.status === 400;
  });
  await runCase(68, 'Private profile fields not exposed', async () => {
    const profile = await fetch(`${BASE}/users/${userB._id}`);
    const reviews = await fetch(`${BASE}/reviews/user/${userB._id}`);
    const text = `${JSON.stringify(await profile.json())}${JSON.stringify(await reviews.json())}`;
    return !text.includes('passwordHash') && !text.includes(userB.email) && !text.includes('verificationToken') && !text.includes(userB.phone);
  });
  await runCase(69, 'Health', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return res.status === 200 && data.success === true && data.data?.database?.connected === true;
  });

  await mongoose.disconnect();

  const phase2 = await runRegression('phase2Validation.js');
  record(70, 'Phase 2', phase2.ok);
  const phase3 = await runRegression('phase3Validation.js');
  record(71, 'Phase 3', phase3.ok);
  const phase4 = await runRegression('phase4Validation.js');
  record(72, 'Phase 4', phase4.ok);
  const phase5 = await runRegression('phase5Validation.js');
  record(73, 'Phase 5', phase5.ok);
  const phase6 = await runRegression('phase6Validation.js');
  record(74, 'Phase 6', phase6.ok);
  const phase7 = await runRegression('phase7Validation.js');
  record(75, 'Phase 7', phase7.ok);
  const phase8 = await runRegression('phase8Validation.js');
  record(76, 'Phase 8', phase8.ok);
  const phase9 = await runRegression('phase9Validation.js');
  record(77, 'Phase 9', phase9.ok);
  const phase10 = await runRegression('phase10Validation.js');
  record(78, 'Phase 10', phase10.ok);

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 11 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) console.log(`Failed tests: ${failed.map((item) => `${item.id} ${item.name}`).join('; ')}`);
  console.log(failed.length ? '--- PHASE 11 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 11 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase11Validation().catch(async (error) => {
  console.error('Phase 11 test suite failed:', error);
  try {
    await clearNotificationValidator();
  } catch {
    // Best-effort validator cleanup.
  }
  process.exit(1);
});
