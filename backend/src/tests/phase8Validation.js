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
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
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

const runPhase8Validation = async () => {
  console.log('--- STARTING PHASE 8 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const emails = [
    'phase8_a@bup.edu.bd',
    'phase8_b@bup.edu.bd',
    'phase8_c@bup.edu.bd',
    'phase8_unverified@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    const conversations = await Conversation.find({ participants: { $in: existingIds } }).select('_id');
    const conversationIds = conversations.map((item) => item._id);
    await Message.deleteMany({ conversation: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
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

  const userA = await makeUser('Phase8 Student A', emails[0], 'phase8-a', true);
  const userB = await makeUser('Phase8 Student B', emails[1], 'phase8-b', true);
  const userC = await makeUser('Phase8 Student C', emails[2], 'phase8-c', true);
  const unverified = await makeUser('Phase8 Unverified', emails[3], 'phase8-unverified', false);

  const tokenA = generateToken(userA._id, 'student');
  const tokenB = generateToken(userB._id, 'student');
  const tokenC = generateToken(userC._id, 'student');
  const tokenUnverified = generateToken(unverified._id, 'student');

  const makeProduct = (title, sellerId, status = 'available') =>
    Product.create({
      title,
      description: 'Phase 8 listing for requests and offers.',
      category: category._id,
      seller: sellerId,
      listingType: 'sell',
      price: 2500,
      condition: 'good',
      campusLocation: 'FST Lab 402',
      status,
    });

  const mainProduct = await makeProduct('Phase 8 Calculator', userB._id);
  const ownProduct = await makeProduct('Phase 8 Own Notebook', userA._id);
  const soldProduct = await makeProduct('Phase 8 Sold Lamp', userB._id, 'sold');
  const cancelProduct = await makeProduct('Phase 8 Cancel Mug', userB._id);
  const acceptProduct = await makeProduct('Phase 8 Accept Keyboard', userB._id);
  const rejectProduct = await makeProduct('Phase 8 Reject Mouse', userB._id);
  const offerProduct = await makeProduct('Phase 8 Offer Textbook', userB._id);
  const offerAcceptProduct = await makeProduct('Phase 8 Offer Accept Bag', userB._id);
  const offerRejectProduct = await makeProduct('Phase 8 Offer Reject Chair', userB._id);
  const offerCancelProduct = await makeProduct('Phase 8 Offer Cancel Pen', userB._id);
  const spoofProduct = await makeProduct('Phase 8 Spoof Headphones', userB._id);
  const failureProduct = await makeProduct('Phase 8 Failure Isolation', userB._id);
  const missingProductId = new mongoose.Types.ObjectId().toString();

  let requestId = null;
  let acceptRequestId = null;
  let rejectRequestId = null;
  let offerId = null;
  let acceptOfferId = null;
  let rejectOfferId = null;

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

  await runCase(1, 'Unauthenticated creation rejected', async () => {
    const res = await fetch(`${BASE}/buy-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: mainProduct._id.toString(), message: 'Interested' }),
    });
    const data = await res.json();
    return res.status === 401 && data.success === false;
  });

  await runCase(2, 'Unverified user rejected', async () => {
    const res = await postRequest(tokenUnverified, {
      productId: mainProduct._id.toString(),
      message: 'I want this',
    });
    const data = await res.json();
    return res.status === 403 && data.success === false;
  });

  await runCase(3, 'Valid buy request created', async () => {
    const res = await postRequest(tokenA, {
      productId: mainProduct._id.toString(),
      message: 'I am interested in buying this item.',
      buyerId: userC._id.toString(),
      sellerId: userC._id.toString(),
      status: 'accepted',
    });
    const data = await res.json();
    requestId = data.data?._id;
    return res.status === 201 && data.success === true && data.data?.status === 'pending' && Boolean(requestId);
  });

  await runCase(4, 'Buyer derived from JWT', async () => {
    const stored = await BuyRequest.findById(requestId);
    return stored?.buyer?.toString() === userA._id.toString();
  });

  await runCase(5, 'Seller derived from product', async () => {
    const stored = await BuyRequest.findById(requestId);
    return stored?.seller?.toString() === userB._id.toString() && stored.seller.toString() !== userC._id.toString();
  });

  await runCase(6, 'Buyer cannot request own product', async () => {
    const res = await postRequest(tokenA, { productId: ownProduct._id.toString(), message: 'Mine' });
    const count = await BuyRequest.countDocuments({ product: ownProduct._id });
    return res.status === 400 && count === 0;
  });

  await runCase(7, 'Invalid product ID rejected', async () => {
    const res = await postRequest(tokenA, { productId: 'not-an-id', message: 'Hello' });
    return res.status === 400;
  });

  await runCase(8, 'Nonexistent product handled', async () => {
    const res = await postRequest(tokenA, { productId: missingProductId, message: 'Hello' });
    return res.status === 404;
  });

  await runCase(9, 'Unavailable product rejected', async () => {
    const res = await postRequest(tokenA, { productId: soldProduct._id.toString(), message: 'Still want it' });
    const count = await BuyRequest.countDocuments({ product: soldProduct._id });
    return res.status === 400 && count === 0;
  });

  await runCase(10, 'Duplicate active request handled', async () => {
    const res = await postRequest(tokenA, { productId: mainProduct._id.toString(), message: 'Again' });
    const count = await BuyRequest.countDocuments({
      product: mainProduct._id,
      buyer: userA._id,
      status: 'pending',
    });
    return res.status === 409 && count === 1;
  });

  await runCase(11, 'Sent requests visible to buyer', async () => {
    const res = await fetch(`${BASE}/buy-requests/sent`, { headers: authHeaders(tokenA) });
    const data = await res.json();
    const serialized = JSON.stringify(data.data || {});
    const found = (data.data?.requests || []).some((item) => item._id === requestId);
    const privateLeak = ['passwordHash', 'verificationToken', emails[0], '+8801700000000'].some((value) => serialized.includes(value));
    return res.status === 200 && found && !privateLeak;
  });

  await runCase(12, 'Received requests visible to seller', async () => {
    const sellerRes = await fetch(`${BASE}/buy-requests/received`, { headers: authHeaders(tokenB) });
    const sellerData = await sellerRes.json();
    const buyerRes = await fetch(`${BASE}/buy-requests/received`, { headers: authHeaders(tokenA) });
    const buyerData = await buyerRes.json();
    const sellerSees = (sellerData.data?.requests || []).some((item) => item._id === requestId);
    const buyerDoesNot = (buyerData.data?.requests || []).every((item) => item._id !== requestId);
    return sellerRes.status === 200 && sellerSees && buyerDoesNot;
  });

  await runCase(13, 'Unauthorized user cannot view request', async () => {
    const res = await fetch(`${BASE}/buy-requests/${requestId}`, { headers: authHeaders(tokenC) });
    return res.status === 403;
  });

  await runCase(14, 'Buyer can cancel pending request', async () => {
    const created = await postRequest(tokenA, { productId: cancelProduct._id.toString(), message: 'Please cancel me' });
    const createdData = await created.json();
    const id = createdData.data?._id;
    const sellerCancel = await fetch(`${BASE}/buy-requests/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const buyerCancel = await fetch(`${BASE}/buy-requests/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const stored = await BuyRequest.findById(id);
    return created.status === 201 && sellerCancel.status === 403 && buyerCancel.status === 200 && stored?.status === 'cancelled';
  });

  await runCase(15, 'Seller can accept pending request', async () => {
    const created = await postRequest(tokenA, { productId: acceptProduct._id.toString(), message: 'I can pick this up.' });
    const createdData = await created.json();
    acceptRequestId = createdData.data?._id;
    const buyerAccept = await fetch(`${BASE}/buy-requests/${acceptRequestId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const sellerAccept = await fetch(`${BASE}/buy-requests/${acceptRequestId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const stored = await BuyRequest.findById(acceptRequestId);
    const product = await Product.findById(acceptProduct._id);
    return buyerAccept.status === 403 && sellerAccept.status === 200 && stored?.status === 'accepted' && product?.status === 'reserved';
  });

  await runCase(16, 'Seller can reject pending request', async () => {
    const created = await postRequest(tokenA, { productId: rejectProduct._id.toString(), message: 'Interested' });
    const createdData = await created.json();
    rejectRequestId = createdData.data?._id;
    const res = await fetch(`${BASE}/buy-requests/${rejectRequestId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const stored = await BuyRequest.findById(rejectRequestId);
    return res.status === 200 && stored?.status === 'rejected';
  });

  await runCase(17, 'Invalid state transition rejected', async () => {
    const acceptAgain = await fetch(`${BASE}/buy-requests/${acceptRequestId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const rejectAccepted = await fetch(`${BASE}/buy-requests/${acceptRequestId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const cancelRejected = await fetch(`${BASE}/buy-requests/${rejectRequestId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const accepted = await BuyRequest.findById(acceptRequestId);
    const rejected = await BuyRequest.findById(rejectRequestId);
    return acceptAgain.status === 409 && rejectAccepted.status === 409 && cancelRejected.status === 409 && accepted.status === 'accepted' && rejected.status === 'rejected';
  });

  await runCase(18, 'Valid offer created', async () => {
    const res = await postOffer(tokenA, {
      productId: offerProduct._id.toString(),
      amount: 2200,
      message: 'Can you accept 2200 BDT?',
      buyerId: userC._id.toString(),
      sellerId: userC._id.toString(),
      status: 'accepted',
    });
    const data = await res.json();
    offerId = data.data?._id;
    return res.status === 201 && data.data?.status === 'pending' && data.data?.amount === 2200 && Boolean(offerId);
  });

  await runCase(19, 'Invalid amount rejected', async () => {
    const negative = await postOffer(tokenA, { productId: offerAcceptProduct._id.toString(), amount: -5 });
    const zero = await postOffer(tokenA, { productId: offerAcceptProduct._id.toString(), amount: 0 });
    const text = await postOffer(tokenA, { productId: offerAcceptProduct._id.toString(), amount: 'free' });
    const huge = await postOffer(tokenA, { productId: offerAcceptProduct._id.toString(), amount: 10000001 });
    const count = await Offer.countDocuments({ product: offerAcceptProduct._id });
    return negative.status === 400 && zero.status === 400 && text.status === 400 && huge.status === 400 && count === 0;
  });

  await runCase(20, 'Buyer derived from JWT', async () => {
    const stored = await Offer.findById(offerId);
    return stored?.buyer?.toString() === userA._id.toString();
  });

  await runCase(21, 'Seller derived from product', async () => {
    const stored = await Offer.findById(offerId);
    return stored?.seller?.toString() === userB._id.toString();
  });

  await runCase(22, 'Buyer cannot offer on own product', async () => {
    const res = await postOffer(tokenA, { productId: ownProduct._id.toString(), amount: 100 });
    const count = await Offer.countDocuments({ product: ownProduct._id });
    return res.status === 400 && count === 0;
  });

  await runCase(23, 'Unavailable product rejected', async () => {
    const res = await postOffer(tokenA, { productId: soldProduct._id.toString(), amount: 100 });
    const count = await Offer.countDocuments({ product: soldProduct._id });
    return res.status === 400 && count === 0;
  });

  await runCase(24, 'Duplicate active offer handled', async () => {
    const res = await postOffer(tokenA, { productId: offerProduct._id.toString(), amount: 2100 });
    const count = await Offer.countDocuments({ product: offerProduct._id, buyer: userA._id, status: 'pending' });
    return res.status === 409 && count === 1;
  });

  await runCase(25, 'Sent offers visible to buyer', async () => {
    const res = await fetch(`${BASE}/offers/sent`, { headers: authHeaders(tokenA) });
    const data = await res.json();
    const found = (data.data?.offers || []).some((item) => item._id === offerId);
    return res.status === 200 && found;
  });

  await runCase(26, 'Received offers visible to seller', async () => {
    const sellerRes = await fetch(`${BASE}/offers/received`, { headers: authHeaders(tokenB) });
    const sellerData = await sellerRes.json();
    const buyerRes = await fetch(`${BASE}/offers/received`, { headers: authHeaders(tokenA) });
    const buyerData = await buyerRes.json();
    const sellerSees = (sellerData.data?.offers || []).some((item) => item._id === offerId);
    const buyerDoesNot = (buyerData.data?.offers || []).every((item) => item._id !== offerId);
    return sellerRes.status === 200 && sellerSees && buyerDoesNot;
  });

  await runCase(27, 'Unauthorized user cannot view offer', async () => {
    const res = await fetch(`${BASE}/offers/${offerId}`, { headers: authHeaders(tokenC) });
    return res.status === 403;
  });

  await runCase(28, 'Seller can accept pending offer', async () => {
    const created = await postOffer(tokenA, { productId: offerAcceptProduct._id.toString(), amount: 1800, message: '1800?' });
    const createdData = await created.json();
    acceptOfferId = createdData.data?._id;
    const buyerAccept = await fetch(`${BASE}/offers/${acceptOfferId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const sellerAccept = await fetch(`${BASE}/offers/${acceptOfferId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const stored = await Offer.findById(acceptOfferId);
    const product = await Product.findById(offerAcceptProduct._id);
    return buyerAccept.status === 403 && sellerAccept.status === 200 && stored?.status === 'accepted' && product?.status === 'reserved';
  });

  await runCase(29, 'Seller can reject pending offer', async () => {
    const created = await postOffer(tokenA, { productId: offerRejectProduct._id.toString(), amount: 50 });
    const createdData = await created.json();
    rejectOfferId = createdData.data?._id;
    const res = await fetch(`${BASE}/offers/${rejectOfferId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const stored = await Offer.findById(rejectOfferId);
    return res.status === 200 && stored?.status === 'rejected';
  });

  await runCase(30, 'Buyer can cancel pending offer', async () => {
    const created = await postOffer(tokenA, { productId: offerCancelProduct._id.toString(), amount: 90 });
    const createdData = await created.json();
    const id = createdData.data?._id;
    const sellerCancel = await fetch(`${BASE}/offers/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const buyerCancel = await fetch(`${BASE}/offers/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ status: 'accepted' }),
    });
    const stored = await Offer.findById(id);
    return sellerCancel.status === 403 && buyerCancel.status === 200 && stored?.status === 'cancelled';
  });

  await runCase(31, 'Invalid state transition rejected', async () => {
    const acceptAgain = await fetch(`${BASE}/offers/${acceptOfferId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const cancelAccepted = await fetch(`${BASE}/offers/${acceptOfferId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const acceptRejected = await fetch(`${BASE}/offers/${rejectOfferId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const accepted = await Offer.findById(acceptOfferId);
    const rejected = await Offer.findById(rejectOfferId);
    return acceptAgain.status === 409 && cancelAccepted.status === 409 && acceptRejected.status === 409 && accepted.status === 'accepted' && rejected.status === 'rejected';
  });

  await runCase(32, 'Buy request notification created', async () => {
    const note = await Notification.findOne({
      recipient: userB._id,
      type: 'BUY_REQUEST_RECEIVED',
      relatedProduct: mainProduct._id,
    });
    return note?.title === 'New buy request' && note?.message === 'Someone is interested in buying your product.' && note.link === `/buy-requests/${requestId}`;
  });

  await runCase(33, 'Request acceptance notification created', async () => {
    const note = await Notification.findOne({
      recipient: userA._id,
      type: 'BUY_REQUEST_ACCEPTED',
      relatedProduct: acceptProduct._id,
    });
    return note?.title === 'Buy request accepted' && note?.message === 'Your buy request was accepted.' && String(note.relatedUser) === userB._id.toString();
  });

  await runCase(34, 'Request rejection notification created', async () => {
    const note = await Notification.findOne({
      recipient: userA._id,
      type: 'BUY_REQUEST_REJECTED',
      relatedProduct: rejectProduct._id,
    });
    return note?.title === 'Buy request rejected' && note?.message === 'Your buy request was rejected.';
  });

  await runCase(35, 'Offer notification created', async () => {
    const note = await Notification.findOne({
      recipient: userB._id,
      type: 'OFFER_RECEIVED',
      relatedProduct: offerProduct._id,
    });
    return note?.title === 'New offer received' && note?.message === 'You received a new offer for your product.' && note.link === `/offers/${offerId}`;
  });

  await runCase(36, 'Offer acceptance notification created', async () => {
    const note = await Notification.findOne({
      recipient: userA._id,
      type: 'OFFER_ACCEPTED',
      relatedProduct: offerAcceptProduct._id,
    });
    return note?.message === 'Your offer was accepted.' && String(note?.relatedUser) === userB._id.toString();
  });

  await runCase(37, 'Offer rejection notification created', async () => {
    const note = await Notification.findOne({
      recipient: userA._id,
      type: 'OFFER_REJECTED',
      relatedProduct: offerRejectProduct._id,
    });
    return note?.message === 'Your offer was rejected.';
  });

  await runCase(38, 'Notification failure does not break operation', async () => {
    const before = await BuyRequest.countDocuments({ product: failureProduct._id });
    const notesBefore = await Notification.countDocuments({ relatedProduct: failureProduct._id });
    await mongoose.connection.db.command({
      collMod: 'notifications',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['__phase8_force_fail'],
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    try {
      const res = await postRequest(tokenA, {
        productId: failureProduct._id.toString(),
        message: 'This request must survive a notification failure.',
      });
      const data = await res.json();
      const after = await BuyRequest.countDocuments({ product: failureProduct._id });
      const notesAfter = await Notification.countDocuments({ relatedProduct: failureProduct._id });
      const stored = await BuyRequest.findById(data.data?._id);
      return res.status === 201 && stored?.status === 'pending' && after === before + 1 && notesAfter === notesBefore;
    } finally {
      await clearNotificationValidator();
    }
  });

  await runCase(39, 'Existing conversation integration works', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({
        recipientId: userB._id.toString(),
        productId: mainProduct._id.toString(),
      }),
    });
    const data = await res.json();
    const ids = (data.data?.participants || []).map((person) => person._id).sort();
    const expected = [userA._id.toString(), userB._id.toString()].sort();
    const messageRes = await fetch(`${BASE}/conversations/${data.data?._id}/messages`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ text: 'Is the calculator still available?' }),
    });
    return res.status === 201 && ids.join() === expected.join() && messageRes.status === 201;
  });

  await runCase(40, 'IDOR protection', async () => {
    const viewRequest = await fetch(`${BASE}/buy-requests/${requestId}`, { headers: authHeaders(tokenC) });
    const viewOffer = await fetch(`${BASE}/offers/${offerId}`, { headers: authHeaders(tokenC) });
    const acceptRequest = await fetch(`${BASE}/buy-requests/${requestId}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenC),
    });
    const rejectOffer = await fetch(`${BASE}/offers/${offerId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(tokenC),
    });
    const cancelRequest = await fetch(`${BASE}/buy-requests/${requestId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenC),
    });
    const storedRequest = await BuyRequest.findById(requestId);
    const storedOffer = await Offer.findById(offerId);
    return (
      viewRequest.status === 403 &&
      viewOffer.status === 403 &&
      acceptRequest.status === 403 &&
      rejectOffer.status === 403 &&
      cancelRequest.status === 403 &&
      storedRequest.status === 'pending' &&
      storedOffer.status === 'pending'
    );
  });

  await runCase(41, 'Client cannot change buyer', async () => {
    const stored = await BuyRequest.findById(requestId);
    const offer = await Offer.findById(offerId);
    return stored.buyer.toString() === userA._id.toString() && offer.buyer.toString() === userA._id.toString();
  });

  await runCase(42, 'Client cannot change seller', async () => {
    const stored = await BuyRequest.findById(requestId);
    const offer = await Offer.findById(offerId);
    return stored.seller.toString() === userB._id.toString() && offer.seller.toString() === userB._id.toString();
  });

  await runCase(43, 'Client cannot directly set status', async () => {
    const res = await postRequest(tokenA, {
      productId: spoofProduct._id.toString(),
      message: 'Status spoof',
      status: 'accepted',
    });
    const data = await res.json();
    const stored = await BuyRequest.findById(data.data?._id);
    const original = await BuyRequest.findById(requestId);
    return res.status === 201 && stored?.status === 'pending' && original.status === 'pending';
  });

  await runCase(44, 'Invalid ObjectIds handled safely', async () => {
    const requestRead = await fetch(`${BASE}/buy-requests/not-an-id`, { headers: authHeaders(tokenA) });
    const offerRead = await fetch(`${BASE}/offers/not-an-id`, { headers: authHeaders(tokenA) });
    const requestCancel = await fetch(`${BASE}/buy-requests/not-an-id/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const offerAccept = await fetch(`${BASE}/offers/not-an-id/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    return requestRead.status === 400 && offerRead.status === 400 && requestCancel.status === 400 && offerAccept.status === 400;
  });

  await runCase(45, 'MongoDB operator injection prevented', async () => {
    const requestRes = await postRequest(tokenA, { productId: { $gt: '' }, message: { $ne: null } });
    const offerRes = await postOffer(tokenA, { productId: mainProduct._id.toString(), amount: { $gt: 0 }, message: { $gt: '' } });
    const badProduct = await postOffer(tokenA, { productId: { $ne: null }, amount: 10 });
    const requestCount = await BuyRequest.countDocuments({ buyer: userA._id, message: { $type: 'object' } });
    return requestRes.status === 400 && offerRes.status === 400 && badProduct.status === 400 && requestCount === 0;
  });

  await runCase(46, 'Health', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return res.status === 200 && data.success === true && data.data?.database?.connected === true;
  });

  await mongoose.disconnect();

  const phase2 = await runRegression('phase2Validation.js');
  record(47, 'Phase 2', phase2.ok);
  const phase3 = await runRegression('phase3Validation.js');
  record(48, 'Phase 3', phase3.ok);
  const phase4 = await runRegression('phase4Validation.js');
  record(49, 'Phase 4', phase4.ok);
  const phase5 = await runRegression('phase5Validation.js');
  record(50, 'Phase 5', phase5.ok);
  const phase6 = await runRegression('phase6Validation.js');
  record(51, 'Phase 6', phase6.ok);
  const phase7 = await runRegression('phase7Validation.js');
  record(52, 'Phase 7', phase7.ok);

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 8 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed tests: ${failed.map((item) => `${item.id} ${item.name}`).join('; ')}`);
  }
  console.log(failed.length ? '--- PHASE 8 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 8 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase8Validation().catch(async (error) => {
  console.error('Phase 8 test suite failed:', error);
  try {
    await clearNotificationValidator();
  } catch {
    // Best-effort validator cleanup.
  }
  process.exit(1);
});
