import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Notification } from '../models/Notification.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ExchangeRequest } from '../models/ExchangeRequest.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { GiveawayRequest } from '../models/GiveawayRequest.js';
import { WantedPost } from '../models/WantedPost.js';
import { Transaction } from '../models/Transaction.js';
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

const runPhase10Validation = async () => {
  console.log('--- STARTING PHASE 10 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  await Promise.all([
    ExchangeRequest.syncIndexes(),
    ExchangeTransaction.syncIndexes(),
    GiveawayRequest.syncIndexes(),
    WantedPost.syncIndexes(),
    Transaction.syncIndexes(),
  ]);

  const emails = [
    'phase10_a@bup.edu.bd',
    'phase10_b@bup.edu.bd',
    'phase10_c@bup.edu.bd',
    'phase10_unverified@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    await ExchangeTransaction.deleteMany({ $or: [{ proposer: { $in: existingIds } }, { owner: { $in: existingIds } }] });
    await ExchangeRequest.deleteMany({ $or: [{ proposer: { $in: existingIds } }, { owner: { $in: existingIds } }] });
    await GiveawayRequest.deleteMany({ $or: [{ requester: { $in: existingIds } }, { owner: { $in: existingIds } }] });
    await WantedPost.deleteMany({ author: { $in: existingIds } });
    await Transaction.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await Message.deleteMany({ sender: { $in: existingIds } });
    await Conversation.deleteMany({ participants: { $in: existingIds } });
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
      phone: '+8801700000010',
      department: 'ICT',
      batch: 'BICE-24',
      campusLocation: 'Mirpur Cantonment Campus',
      role: 'student',
      isVerified,
      status: 'active',
    });

  const userA = await makeUser('Phase10 Student A', emails[0], 'phase10-a', true);
  const userB = await makeUser('Phase10 Student B', emails[1], 'phase10-b', true);
  const userC = await makeUser('Phase10 Student C', emails[2], 'phase10-c', true);
  const unverified = await makeUser('Phase10 Unverified', emails[3], 'phase10-unverified', false);
  const tokenA = generateToken(userA._id, 'student');
  const tokenB = generateToken(userB._id, 'student');
  const tokenC = generateToken(userC._id, 'student');
  const tokenUnverified = generateToken(unverified._id, 'student');

  const makeProduct = ({ title, seller, listingType = 'exchange', status = 'available', price = 0 }) =>
    Product.create({
      title,
      description: 'Phase 10 campus listing.',
      category: category._id,
      seller,
      listingType,
      price,
      condition: 'good',
      campusLocation: 'FST Lab 402',
      status,
      images: [{ url: '/uploads/phase10-item.jpg', isThumbnail: true }],
    });

  const postExchange = (token, body) =>
    fetch(`${BASE}/exchange-requests`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });

  const postGiveaway = (token, body) =>
    fetch(`${BASE}/giveaway-requests`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });

  const postWanted = (token, body) =>
    fetch(`${BASE}/wanted-posts`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });

  const requested = await makeProduct({ title: 'Phase10 Requested Textbook', seller: userB._id });
  const offered = await makeProduct({ title: 'Phase10 Offered Calculator', seller: userA._id });
  const sellListing = await makeProduct({ title: 'Phase10 Sell Lamp', seller: userB._id, listingType: 'sell', price: 1200 });
  const unavailableRequested = await makeProduct({ title: 'Phase10 Reserved Requested', seller: userB._id, status: 'reserved' });
  const unavailableOffered = await makeProduct({ title: 'Phase10 Reserved Offered', seller: userA._id, status: 'reserved' });
  const foreignOffered = await makeProduct({ title: 'Phase10 Foreign Offering', seller: userC._id });
  const ownRequested = await makeProduct({ title: 'Phase10 Own Requested', seller: userA._id });
  const acceptRequested = await makeProduct({ title: 'Phase10 Accept Requested', seller: userB._id });
  const acceptOffered = await makeProduct({ title: 'Phase10 Accept Offered', seller: userA._id });
  const rejectRequested = await makeProduct({ title: 'Phase10 Reject Requested', seller: userB._id });
  const rejectOffered = await makeProduct({ title: 'Phase10 Reject Offered', seller: userA._id });
  const completeRequested = await makeProduct({ title: 'Phase10 Complete Requested', seller: userB._id });
  const completeOffered = await makeProduct({ title: 'Phase10 Complete Offered', seller: userA._id });
  const cancelRequested = await makeProduct({ title: 'Phase10 Cancel Requested', seller: userB._id });
  const cancelOffered = await makeProduct({ title: 'Phase10 Cancel Offered', seller: userA._id });

  const created = await postExchange(tokenA, {
    requestedProductId: requested._id.toString(),
    offeredProductId: offered._id.toString(),
    message: 'Would you like to exchange these items?',
    proposerId: userC._id.toString(),
    ownerId: userC._id.toString(),
    status: 'accepted',
  });
  const createdBody = await created.json();
  const exchangeId = createdBody.data?._id;

  await runCase(1, 'Valid exchange request', async () => created.status === 201 && createdBody.data?.status === 'pending');
  await runCase(2, 'Unauthenticated exchange rejected', async () => {
    const res = await postExchange(null, { requestedProductId: requested._id.toString(), offeredProductId: offered._id.toString() });
    return res.status === 401;
  });
  await runCase(3, 'Unverified exchange rejected', async () => {
    const res = await postExchange(tokenUnverified, { requestedProductId: requested._id.toString(), offeredProductId: offered._id.toString() });
    return res.status === 403;
  });
  await runCase(4, 'Proposer from JWT', async () => createdBody.data?.proposer?._id === userA._id.toString());
  await runCase(5, 'Owner from product', async () => createdBody.data?.owner?._id === userB._id.toString());
  await runCase(6, 'Cannot exchange with own product', async () => {
    const res = await postExchange(tokenA, { requestedProductId: ownRequested._id.toString(), offeredProductId: offered._id.toString() });
    return res.status === 400;
  });
  await runCase(7, 'Invalid product IDs rejected', async () => {
    const res = await postExchange(tokenA, { requestedProductId: 'not-an-id', offeredProductId: offered._id.toString() });
    return res.status === 400;
  });
  await runCase(8, 'Offered product ownership enforced', async () => {
    const res = await postExchange(tokenA, { requestedProductId: acceptRequested._id.toString(), offeredProductId: foreignOffered._id.toString() });
    return res.status === 403;
  });
  await runCase(9, 'Requested product must be exchange listing', async () => {
    const res = await postExchange(tokenA, { requestedProductId: sellListing._id.toString(), offeredProductId: offered._id.toString() });
    return res.status === 400;
  });
  await runCase(10, 'Requested product must be available', async () => {
    const res = await postExchange(tokenA, { requestedProductId: unavailableRequested._id.toString(), offeredProductId: acceptOffered._id.toString() });
    return res.status === 400;
  });
  await runCase(11, 'Offered product must be available', async () => {
    const res = await postExchange(tokenA, { requestedProductId: acceptRequested._id.toString(), offeredProductId: unavailableOffered._id.toString() });
    return res.status === 400;
  });
  await runCase(12, 'Duplicate pending exchange prevented', async () => {
    const res = await postExchange(tokenA, { requestedProductId: requested._id.toString(), offeredProductId: offered._id.toString() });
    return res.status === 409;
  });
  await runCase(13, 'Sent exchange requests', async () => {
    const sentA = await fetch(`${BASE}/exchange-requests/sent`, { headers: authHeaders(tokenA) });
    const sentB = await fetch(`${BASE}/exchange-requests/sent`, { headers: authHeaders(tokenB) });
    const dataA = await sentA.json();
    const dataB = await sentB.json();
    const idsA = (dataA.data?.requests || []).map((item) => item._id);
    const idsB = (dataB.data?.requests || []).map((item) => item._id);
    return sentA.status === 200 && idsA.includes(exchangeId) && !idsB.includes(exchangeId);
  });
  await runCase(14, 'Received exchange requests', async () => {
    const receivedB = await fetch(`${BASE}/exchange-requests/received`, { headers: authHeaders(tokenB) });
    const receivedA = await fetch(`${BASE}/exchange-requests/received`, { headers: authHeaders(tokenA) });
    const dataB = await receivedB.json();
    const dataA = await receivedA.json();
    const idsB = (dataB.data?.requests || []).map((item) => item._id);
    const idsA = (dataA.data?.requests || []).map((item) => item._id);
    return receivedB.status === 200 && idsB.includes(exchangeId) && !idsA.includes(exchangeId);
  });
  await runCase(15, 'Unauthorized exchange access rejected', async () => {
    const res = await fetch(`${BASE}/exchange-requests/${exchangeId}`, { headers: authHeaders(tokenC) });
    return res.status === 403;
  });
  await runCase(16, 'Proposer can cancel', async () => {
    const res = await fetch(`${BASE}/exchange-requests/${exchangeId}/cancel`, { method: 'PATCH', headers: authHeaders(tokenA) });
    const data = await res.json();
    const ownerCancel = await fetch(`${BASE}/exchange-requests/${exchangeId}/cancel`, { method: 'PATCH', headers: authHeaders(tokenB) });
    return res.status === 200 && data.data?.status === 'cancelled' && ownerCancel.status === 403;
  });

  const acceptRes = await postExchange(tokenA, {
    requestedProductId: acceptRequested._id.toString(),
    offeredProductId: acceptOffered._id.toString(),
    message: 'Accept this exchange.',
  });
  const acceptBody = await acceptRes.json();
  const acceptId = acceptBody.data?._id;
  const accepted = await fetch(`${BASE}/exchange-requests/${acceptId}/accept`, { method: 'PATCH', headers: authHeaders(tokenB) });
  const acceptedBody = await accepted.json();

  await runCase(17, 'Owner can accept', async () => {
    const [requestedProduct, offeredProduct] = await Promise.all([
      Product.findById(acceptRequested._id),
      Product.findById(acceptOffered._id),
    ]);
    const monetary = await Transaction.countDocuments({
      product: { $in: [acceptRequested._id, acceptOffered._id] },
    });
    return (
      accepted.status === 200 &&
      acceptedBody.data?.status === 'accepted' &&
      acceptedBody.meta?.exchangeTransactionId &&
      requestedProduct.status === 'reserved' &&
      offeredProduct.status === 'reserved' &&
      monetary === 0
    );
  });

  const rejectRes = await postExchange(tokenA, {
    requestedProductId: rejectRequested._id.toString(),
    offeredProductId: rejectOffered._id.toString(),
  });
  const rejectBody = await rejectRes.json();
  const rejected = await fetch(`${BASE}/exchange-requests/${rejectBody.data?._id}/reject`, { method: 'PATCH', headers: authHeaders(tokenB) });
  const rejectedBody = await rejected.json();

  await runCase(18, 'Owner can reject', async () => rejected.status === 200 && rejectedBody.data?.status === 'rejected');
  await runCase(19, 'Invalid exchange state transition rejected', async () => {
    const again = await fetch(`${BASE}/exchange-requests/${acceptId}/accept`, { method: 'PATCH', headers: authHeaders(tokenB) });
    const cancelAccepted = await fetch(`${BASE}/exchange-requests/${acceptId}/cancel`, { method: 'PATCH', headers: authHeaders(tokenA) });
    const acceptRejected = await fetch(`${BASE}/exchange-requests/${rejectBody.data?._id}/accept`, { method: 'PATCH', headers: authHeaders(tokenB) });
    return again.status === 409 && cancelAccepted.status === 409 && acceptRejected.status === 409;
  });

  await runCase(20, 'Exchange completion and cancellation lifecycle', async () => {
    const completeRes = await postExchange(tokenA, {
      requestedProductId: completeRequested._id.toString(),
      offeredProductId: completeOffered._id.toString(),
      message: 'Complete this exchange.',
    });
    const completeBody = await completeRes.json();
    const completeAccept = await fetch(`${BASE}/exchange-requests/${completeBody.data?._id}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const completeAcceptBody = await completeAccept.json();
    const transactionId = completeAcceptBody.meta?.exchangeTransactionId;
    const proposerConfirm = await fetch(`${BASE}/exchange-transactions/${transactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const ownerConfirm = await fetch(`${BASE}/exchange-transactions/${transactionId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const [soldRequested, soldOffered, exchangeTxn] = await Promise.all([
      Product.findById(completeRequested._id),
      Product.findById(completeOffered._id),
      ExchangeTransaction.findById(transactionId),
    ]);

    const cancelRes = await postExchange(tokenA, {
      requestedProductId: cancelRequested._id.toString(),
      offeredProductId: cancelOffered._id.toString(),
    });
    const cancelBody = await cancelRes.json();
    const cancelAccept = await fetch(`${BASE}/exchange-requests/${cancelBody.data?._id}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const cancelAcceptBody = await cancelAccept.json();
    const cancelTxn = await fetch(`${BASE}/exchange-transactions/${cancelAcceptBody.meta?.exchangeTransactionId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ cancellationReason: 'Plans changed.' }),
    });
    const [releasedRequested, releasedOffered] = await Promise.all([
      Product.findById(cancelRequested._id),
      Product.findById(cancelOffered._id),
    ]);

    return (
      completeAccept.status === 200 &&
      proposerConfirm.status === 200 &&
      ownerConfirm.status === 200 &&
      exchangeTxn?.status === 'COMPLETED' &&
      exchangeTxn?.completedAt &&
      soldRequested.status === 'sold' &&
      soldOffered.status === 'sold' &&
      cancelTxn.status === 200 &&
      releasedRequested.status === 'available' &&
      releasedOffered.status === 'available'
    );
  });

  const wantedPayload = {
    title: 'Phase10 Graphing calculator wanted',
    description: 'Looking for a working calculator for ICT labs.',
    categoryId: category._id.toString(),
    budgetMin: 100,
    budgetMax: 500,
    campusLocation: 'Mirpur Phase10 Lab',
    author: userC._id.toString(),
    status: 'fulfilled',
  };
  const wantedRes = await postWanted(tokenA, wantedPayload);
  const wantedBody = await wantedRes.json();
  const wantedId = wantedBody.data?._id;

  await runCase(21, 'Create wanted post', async () => wantedRes.status === 201 && wantedBody.data?.status === 'active');
  await runCase(22, 'Unauthenticated wanted creation rejected', async () => (await postWanted(null, wantedPayload)).status === 401);
  await runCase(23, 'Unverified wanted creation rejected', async () => (await postWanted(tokenUnverified, wantedPayload)).status === 403);
  await runCase(24, 'Wanted author from JWT', async () => wantedBody.data?.author?._id === userA._id.toString());
  await runCase(25, 'Invalid category handled', async () => {
    const bad = await postWanted(tokenA, { ...wantedPayload, title: 'Bad category', categoryId: 'not-an-id' });
    const missing = await postWanted(tokenA, { ...wantedPayload, title: 'Missing category', categoryId: new mongoose.Types.ObjectId().toString() });
    return bad.status === 400 && missing.status === 404;
  });
  await runCase(26, 'Invalid budget rejected', async () => {
    const res = await postWanted(tokenA, { ...wantedPayload, title: 'Negative budget', budgetMin: -5, budgetMax: 20 });
    return res.status === 400;
  });
  await runCase(27, 'minBudget greater than maxBudget rejected', async () => {
    const res = await postWanted(tokenA, { ...wantedPayload, title: 'Inverted budget', budgetMin: 800, budgetMax: 100 });
    return res.status === 400;
  });

  const decoy = await postWanted(tokenB, {
    title: 'Phase10 Decoy charger',
    description: 'A different campus request.',
    budgetMin: 1,
    budgetMax: 10,
    campusLocation: 'Other Hall',
  });
  const decoyBody = await decoy.json();

  await runCase(28, 'Public wanted listing', async () => {
    const res = await fetch(`${BASE}/wanted-posts?q=Phase10`);
    const data = await res.json();
    const posts = data.data?.posts || [];
    const serialized = JSON.stringify(posts);
    return res.status === 200 && posts.some((post) => post._id === wantedId) && !serialized.includes(emails[0]) && !serialized.includes('passwordHash');
  });
  await runCase(29, 'Wanted search', async () => {
    const res = await fetch(`${BASE}/wanted-posts?q=Graphing%20calculator`);
    const data = await res.json();
    const ids = (data.data?.posts || []).map((post) => post._id);
    return ids.includes(wantedId) && !ids.includes(decoyBody.data?._id);
  });
  await runCase(30, 'Wanted category filter', async () => {
    const res = await fetch(`${BASE}/wanted-posts?q=Phase10&category=${category._id}`);
    const data = await res.json();
    const ids = (data.data?.posts || []).map((post) => post._id);
    return ids.includes(wantedId) && !ids.includes(decoyBody.data?._id);
  });
  await runCase(31, 'Wanted budget filtering', async () => {
    const res = await fetch(`${BASE}/wanted-posts?q=Phase10&minBudget=200&maxBudget=400`);
    const data = await res.json();
    const ids = (data.data?.posts || []).map((post) => post._id);
    return ids.includes(wantedId) && !ids.includes(decoyBody.data?._id);
  });
  await runCase(32, 'Wanted campus filtering', async () => {
    const res = await fetch(`${BASE}/wanted-posts?campusLocation=Mirpur%20Phase10`);
    const data = await res.json();
    const ids = (data.data?.posts || []).map((post) => post._id);
    return ids.includes(wantedId) && !ids.includes(decoyBody.data?._id);
  });
  await runCase(33, 'Wanted pagination', async () => {
    await postWanted(tokenA, { ...wantedPayload, title: 'Phase10 Page Alpha' });
    await postWanted(tokenA, { ...wantedPayload, title: 'Phase10 Page Beta' });
    const page = await fetch(`${BASE}/wanted-posts?q=Phase10%20Page&limit=1&page=2`);
    const bounded = await fetch(`${BASE}/wanted-posts?q=Phase10%20Page&limit=100`);
    const pageData = await page.json();
    const boundedData = await bounded.json();
    return (
      page.status === 200 &&
      pageData.data?.posts?.length === 1 &&
      pageData.data?.pagination?.hasPreviousPage === true &&
      pageData.data?.pagination?.page === 2 &&
      boundedData.data?.pagination?.limit === 50
    );
  });
  await runCase(34, 'Owner can edit wanted post', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${wantedId}`, {
      method: 'PUT',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ title: 'Phase10 Graphing calculator updated', author: userC._id.toString() }),
    });
    const data = await res.json();
    return res.status === 200 && data.data?.title === 'Phase10 Graphing calculator updated' && data.data?.author?._id === userA._id.toString();
  });
  await runCase(35, 'Non-owner cannot edit wanted post', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${wantedId}`, {
      method: 'PUT',
      headers: authHeaders(tokenC, true),
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    return res.status === 403;
  });

  const fulfillRes = await postWanted(tokenA, { ...wantedPayload, title: 'Phase10 Fulfill me' });
  const fulfillBody = await fulfillRes.json();

  await runCase(36, 'Owner can close wanted post', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${wantedId}/status`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ status: 'closed' }),
    });
    const data = await res.json();
    const edit = await fetch(`${BASE}/wanted-posts/${wantedId}`, {
      method: 'PUT',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ title: 'Should stay closed' }),
    });
    return res.status === 200 && data.data?.status === 'closed' && edit.status === 409;
  });
  await runCase(37, 'Owner can mark wanted post fulfilled', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${fulfillBody.data?._id}/status`, {
      method: 'PATCH',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ status: 'fulfilled' }),
    });
    const data = await res.json();
    return res.status === 200 && data.data?.status === 'fulfilled';
  });
  await runCase(38, 'Non-owner cannot change wanted status', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${decoyBody.data?._id}/status`, {
      method: 'PATCH',
      headers: authHeaders(tokenC, true),
      body: JSON.stringify({ status: 'closed' }),
    });
    return res.status === 403;
  });
  await runCase(39, 'Owner can delete wanted post', async () => {
    const removable = await postWanted(tokenA, { ...wantedPayload, title: 'Phase10 Delete me' });
    const removableBody = await removable.json();
    const res = await fetch(`${BASE}/wanted-posts/${removableBody.data?._id}`, { method: 'DELETE', headers: authHeaders(tokenA) });
    const gone = await fetch(`${BASE}/wanted-posts/${removableBody.data?._id}`);
    return res.status === 200 && gone.status === 404;
  });
  await runCase(40, 'Non-owner cannot delete wanted post', async () => {
    const res = await fetch(`${BASE}/wanted-posts/${decoyBody.data?._id}`, { method: 'DELETE', headers: authHeaders(tokenC) });
    return res.status === 403;
  });

  const giveaway = await makeProduct({ title: 'Phase10 Free Notebook', seller: userB._id, listingType: 'giveaway' });
  const giveawayCancel = await makeProduct({ title: 'Phase10 Free Pen', seller: userB._id, listingType: 'giveaway' });
  const giveawayReject = await makeProduct({ title: 'Phase10 Free Marker', seller: userB._id, listingType: 'giveaway' });
  const ownGiveaway = await makeProduct({ title: 'Phase10 Own Giveaway', seller: userA._id, listingType: 'giveaway' });
  const reservedGiveaway = await makeProduct({ title: 'Phase10 Reserved Giveaway', seller: userB._id, listingType: 'giveaway', status: 'reserved' });
  const failureGiveaway = await makeProduct({ title: 'Phase10 Failure Giveaway', seller: userB._id, listingType: 'giveaway' });

  const giveawayRes = await postGiveaway(tokenA, {
    productId: giveaway._id.toString(),
    message: 'I can use this notebook.',
    requesterId: userC._id.toString(),
    ownerId: userC._id.toString(),
    status: 'accepted',
  });
  const giveawayBody = await giveawayRes.json();
  const giveawayId = giveawayBody.data?._id;

  await runCase(41, 'Valid giveaway request', async () => giveawayRes.status === 201 && giveawayBody.data?.status === 'pending');
  await runCase(42, 'Unauthenticated giveaway rejected', async () => (await postGiveaway(null, { productId: giveaway._id.toString() })).status === 401);
  await runCase(43, 'Unverified giveaway rejected', async () => (await postGiveaway(tokenUnverified, { productId: giveaway._id.toString() })).status === 403);
  await runCase(44, 'Product must be giveaway listing', async () => (await postGiveaway(tokenA, { productId: sellListing._id.toString() })).status === 400);
  await runCase(45, 'Giveaway product must be available', async () => (await postGiveaway(tokenA, { productId: reservedGiveaway._id.toString() })).status === 400);
  await runCase(46, 'Requester cannot request own giveaway', async () => (await postGiveaway(tokenA, { productId: ownGiveaway._id.toString() })).status === 400);
  await runCase(47, 'Duplicate pending giveaway prevented', async () => (await postGiveaway(tokenA, { productId: giveaway._id.toString() })).status === 409);
  await runCase(48, 'Sent giveaway requests', async () => {
    const sent = await fetch(`${BASE}/giveaway-requests/sent`, { headers: authHeaders(tokenA) });
    const data = await sent.json();
    return sent.status === 200 && (data.data?.requests || []).some((item) => item._id === giveawayId);
  });
  await runCase(49, 'Received giveaway requests', async () => {
    const received = await fetch(`${BASE}/giveaway-requests/received`, { headers: authHeaders(tokenB) });
    const data = await received.json();
    return received.status === 200 && (data.data?.requests || []).some((item) => item._id === giveawayId);
  });
  await runCase(50, 'Unauthorized giveaway access rejected', async () => {
    const res = await fetch(`${BASE}/giveaway-requests/${giveawayId}`, { headers: authHeaders(tokenC) });
    return res.status === 403;
  });
  await runCase(51, 'Requester can cancel giveaway', async () => {
    const createdCancel = await postGiveaway(tokenA, { productId: giveawayCancel._id.toString(), message: 'Cancel me' });
    const createdCancelBody = await createdCancel.json();
    const res = await fetch(`${BASE}/giveaway-requests/${createdCancelBody.data?._id}/cancel`, { method: 'PATCH', headers: authHeaders(tokenA) });
    const data = await res.json();
    return res.status === 200 && data.data?.status === 'cancelled';
  });

  const giveawayAccepted = await fetch(`${BASE}/giveaway-requests/${giveawayId}/accept`, { method: 'PATCH', headers: authHeaders(tokenB) });
  const giveawayAcceptedBody = await giveawayAccepted.json();
  const giveawayTransactionId = giveawayAcceptedBody.meta?.transactionId;

  await runCase(52, 'Owner can accept giveaway', async () => {
    const product = await Product.findById(giveaway._id);
    const txn = await Transaction.findById(giveawayTransactionId);
    const offerCount = await mongoose.connection.collection('offers').countDocuments({ product: giveaway._id });
    return (
      giveawayAccepted.status === 200 &&
      giveawayAcceptedBody.data?.status === 'accepted' &&
      product.status === 'reserved' &&
      txn?.sourceType === 'GIVEAWAY_REQUEST' &&
      txn?.agreedPrice === 0 &&
      txn?.buyer.toString() === userA._id.toString() &&
      txn?.seller.toString() === userB._id.toString() &&
      offerCount === 0
    );
  });

  const rejectGiveawayRes = await postGiveaway(tokenA, { productId: giveawayReject._id.toString() });
  const rejectGiveawayBody = await rejectGiveawayRes.json();
  const rejectedGiveaway = await fetch(`${BASE}/giveaway-requests/${rejectGiveawayBody.data?._id}/reject`, {
    method: 'PATCH',
    headers: authHeaders(tokenB),
  });

  await runCase(53, 'Owner can reject giveaway', async () => {
    const data = await rejectedGiveaway.json();
    return rejectedGiveaway.status === 200 && data.data?.status === 'rejected';
  });
  await runCase(54, 'Invalid giveaway state transition rejected', async () => {
    const again = await fetch(`${BASE}/giveaway-requests/${giveawayId}/accept`, { method: 'PATCH', headers: authHeaders(tokenB) });
    const cancelAccepted = await fetch(`${BASE}/giveaway-requests/${giveawayId}/cancel`, { method: 'PATCH', headers: authHeaders(tokenA) });
    const acceptRejected = await fetch(`${BASE}/giveaway-requests/${rejectGiveawayBody.data?._id}/accept`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    return again.status === 409 && cancelAccepted.status === 409 && acceptRejected.status === 409;
  });
  await runCase(55, 'Giveaway completion lifecycle', async () => {
    const buyerConfirm = await fetch(`${BASE}/transactions/${giveawayTransactionId}/confirm`, { method: 'PATCH', headers: authHeaders(tokenA) });
    const sellerConfirm = await fetch(`${BASE}/transactions/${giveawayTransactionId}/confirm`, { method: 'PATCH', headers: authHeaders(tokenB) });
    const [product, txn] = await Promise.all([
      Product.findById(giveaway._id),
      Transaction.findById(giveawayTransactionId),
    ]);
    return buyerConfirm.status === 200 && sellerConfirm.status === 200 && txn?.status === 'COMPLETED' && txn?.agreedPrice === 0 && product.status === 'sold';
  });

  await runCase(56, 'Exchange notification created', async () => {
    const note = await Notification.findOne({ type: 'EXCHANGE_REQUEST_RECEIVED', recipient: userB._id, relatedProduct: requested._id });
    return Boolean(note);
  });
  await runCase(57, 'Giveaway notification created', async () => {
    const note = await Notification.findOne({ type: 'GIVEAWAY_REQUEST_RECEIVED', recipient: userB._id, relatedProduct: giveaway._id });
    return Boolean(note);
  });
  await runCase(58, 'Wanted post notification created', async () => {
    const live = await postWanted(tokenA, { ...wantedPayload, title: 'Phase10 Contact me', status: 'active' });
    const liveBody = await live.json();
    const contact = await fetch(`${BASE}/wanted-posts/${liveBody.data?._id}/contact`, { method: 'POST', headers: authHeaders(tokenB) });
    const contactBody = await contact.json();
    const note = await Notification.findOne({ type: 'WANTED_POST_RESPONSE', recipient: userA._id });
    return contact.status === 201 && contactBody.data?._id && Boolean(note);
  });
  await runCase(59, 'Notification failure does not break operation', async () => {
    const before = await GiveawayRequest.countDocuments({ product: failureGiveaway._id });
    await mongoose.connection.db.command({
      collMod: 'notifications',
      validator: { $jsonSchema: { bsonType: 'object', required: ['__phase10_force_fail'] } },
      validationLevel: 'strict',
      validationAction: 'error',
    });
    try {
      const res = await postGiveaway(tokenA, { productId: failureGiveaway._id.toString(), message: 'Survive notification failure' });
      const data = await res.json();
      const after = await GiveawayRequest.countDocuments({ product: failureGiveaway._id });
      return res.status === 201 && data.data?.status === 'pending' && after === before + 1;
    } finally {
      await clearNotificationValidator();
    }
  });

  await runCase(60, 'Existing messaging reused for exchange', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: userB._id.toString(), productId: acceptRequested._id.toString() }),
    });
    const data = await res.json();
    const participants = (data.data?.participants || []).map((item) => item._id || item);
    return (res.status === 201 || res.status === 200) && participants.length === 2;
  });
  await runCase(61, 'Existing messaging reused for giveaway', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: userB._id.toString(), productId: giveaway._id.toString() }),
    });
    const data = await res.json();
    return (res.status === 201 || res.status === 200) && data.data?._id && !data.data?.passwordHash;
  });
  await runCase(62, 'Existing messaging reused for wanted posts', async () => {
    const live = await WantedPost.findOne({ title: 'Phase10 Contact me', author: userA._id });
    const contact = await fetch(`${BASE}/wanted-posts/${live._id}/contact`, { method: 'POST', headers: authHeaders(tokenC) });
    const contactBody = await contact.json();
    const message = await fetch(`${BASE}/conversations/${contactBody.data?._id}/messages`, {
      method: 'POST',
      headers: authHeaders(tokenC, true),
      body: JSON.stringify({ text: 'I have the calculator you wanted.' }),
    });
    return (contact.status === 200 || contact.status === 201) && message.status === 201;
  });

  await runCase(63, 'IDOR protection', async () => {
    const exchange = await fetch(`${BASE}/exchange-requests/${acceptId}`, { headers: authHeaders(tokenC) });
    const give = await fetch(`${BASE}/giveaway-requests/${giveawayId}`, { headers: authHeaders(tokenC) });
    const edit = await fetch(`${BASE}/wanted-posts/${decoyBody.data?._id}`, {
      method: 'PUT',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ title: 'Not yours' }),
    });
    return exchange.status === 403 && give.status === 403 && edit.status === 403;
  });
  await runCase(64, 'Client cannot change owner', async () => {
    const stored = await ExchangeRequest.findById(exchangeId);
    const giveawayStored = await GiveawayRequest.findById(giveawayId);
    return stored.owner.toString() === userB._id.toString() && giveawayStored.owner.toString() === userB._id.toString();
  });
  await runCase(65, 'Client cannot change requester or proposer', async () => {
    const stored = await ExchangeRequest.findById(exchangeId);
    const giveawayStored = await GiveawayRequest.findById(giveawayId);
    return stored.proposer.toString() === userA._id.toString() && giveawayStored.requester.toString() === userA._id.toString();
  });
  await runCase(66, 'Client cannot directly set status', async () => createdBody.data?.status === 'pending' && giveawayBody.data?.status === 'pending' && wantedBody.data?.status === 'active');
  await runCase(67, 'Invalid ObjectIds handled safely', async () => {
    const exchange = await fetch(`${BASE}/exchange-requests/not-an-id`, { headers: authHeaders(tokenA) });
    const give = await fetch(`${BASE}/giveaway-requests/not-an-id`, { headers: authHeaders(tokenA) });
    const wanted = await fetch(`${BASE}/wanted-posts/not-an-id`);
    return exchange.status === 400 && give.status === 400 && wanted.status === 400;
  });
  await runCase(68, 'MongoDB operator injection prevented', async () => {
    const before = await GiveawayRequest.countDocuments({ requester: userA._id });
    const res = await postGiveaway(tokenA, { productId: { $gt: '' }, message: { $ne: null } });
    const after = await GiveawayRequest.countDocuments({ requester: userA._id });
    const exchange = await postExchange(tokenA, { requestedProductId: { $gt: '' }, offeredProductId: offered._id.toString(), message: { $ne: null } });
    return res.status === 400 && exchange.status === 400 && after === before;
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

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 10 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed tests: ${failed.map((item) => `${item.id} ${item.name}`).join('; ')}`);
  }
  console.log(failed.length ? '--- PHASE 10 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 10 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase10Validation().catch(async (error) => {
  console.error('Phase 10 test suite failed:', error);
  try {
    await clearNotificationValidator();
  } catch {
    // Best-effort validator cleanup.
  }
  process.exit(1);
});
