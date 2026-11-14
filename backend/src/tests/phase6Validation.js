import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Wishlist } from '../models/Wishlist.js';
import { Notification } from '../models/Notification.js';
import { createNotification } from '../services/notificationService.js';
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
      resolve({ code, fails, ok: code === 0 && fails === 0 });
    });
  });

const runPhase6Validation = async () => {
  console.log('--- STARTING PHASE 6 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const emails = [
    'phase6_seller@bup.edu.bd',
    'phase6_buyer@bup.edu.bd',
    'phase6_other@bup.edu.bd',
    'phase6_unverified@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    await Wishlist.deleteMany({ user: { $in: existingIds } });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await Product.deleteMany({ seller: { $in: existingIds } });
    await User.deleteMany({ _id: { $in: existingIds } });
  }

  const category = await Category.findOne();
  if (!category) {
    throw new Error('No categories found. Start the API once so category seed can run.');
  }

  const seller = await User.create({
    name: 'Phase6 Seller',
    email: emails[0],
    passwordHash: 'dummy_hash',
    studentId: 'phase6-seller',
    phone: '+8801711111111',
    campusLocation: 'Mirpur Cantonment Campus',
    role: 'student',
    isVerified: true,
    status: 'active',
  });

  const buyer = await User.create({
    name: 'Phase6 Buyer',
    email: emails[1],
    passwordHash: 'dummy_hash',
    studentId: 'phase6-buyer',
    phone: '+8801722222222',
    campusLocation: 'Mirpur Cantonment Campus',
    role: 'student',
    isVerified: true,
    status: 'active',
  });

  const other = await User.create({
    name: 'Phase6 Other',
    email: emails[2],
    passwordHash: 'dummy_hash',
    studentId: 'phase6-other',
    phone: '+8801733333333',
    campusLocation: 'Mirpur Cantonment Campus',
    role: 'student',
    isVerified: true,
    status: 'active',
  });

  const unverified = await User.create({
    name: 'Phase6 Unverified',
    email: emails[3],
    passwordHash: 'dummy_hash',
    studentId: 'phase6-unverified',
    campusLocation: 'Mirpur Cantonment Campus',
    role: 'student',
    isVerified: false,
    status: 'active',
  });

  const sellerToken = generateToken(seller._id, 'student');
  const buyerToken = generateToken(buyer._id, 'student');
  const otherToken = generateToken(other._id, 'student');
  const unverifiedToken = generateToken(unverified._id, 'student');

  const product = await Product.create({
    title: 'Phase 6 Lab Notebook',
    description: 'Wishlist validation listing.',
    category: category._id,
    seller: seller._id,
    listingType: 'sell',
    price: 250,
    condition: 'good',
    campusLocation: 'FST Lab 402',
    status: 'available',
  });

  await runCase(1, 'Unauthenticated wishlist request rejected', async () => {
    const res = await fetch(`${BASE}/wishlist`);
    const data = await res.json();
    return res.status === 401 && data.success === false;
  });

  await runCase(2, 'Unverified user cannot perform protected wishlist action', async () => {
    const res = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'POST',
      headers: authHeaders(unverifiedToken),
    });
    const data = await res.json();
    const saved = await Wishlist.countDocuments({ user: unverified._id, product: product._id });
    return res.status === 403 && data.success === false && saved === 0;
  });

  await runCase(3, 'Add product to wishlist', async () => {
    const res = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'POST',
      headers: authHeaders(buyerToken, true),
      body: JSON.stringify({ user: other._id }),
    });
    const data = await res.json();
    const entry = await Wishlist.findOne({ product: product._id });
    return res.status === 201 && data.success === true && data.data?.wishlisted === true && entry?.user.toString() === buyer._id.toString();
  });

  await runCase(4, 'Duplicate wishlist prevented', async () => {
    const res = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const count = await Wishlist.countDocuments({ user: buyer._id, product: product._id });
    return res.status === 200 && data.success === true && data.data?.wishlisted === true && count === 1;
  });

  await runCase(5, 'Get own wishlist', async () => {
    const res = await fetch(`${BASE}/wishlist`, { headers: authHeaders(buyerToken) });
    const data = await res.json();
    const items = data.data?.items || [];
    return res.status === 200 && data.data?.count === 1 && items[0]?.product?._id === product._id.toString();
  });

  await runCase(6, 'Wishlist product includes safe seller information only', async () => {
    const res = await fetch(`${BASE}/wishlist`, { headers: authHeaders(buyerToken) });
    const data = await res.json();
    const savedProduct = data.data?.items?.[0]?.product;
    const sellerInfo = savedProduct?.seller;
    const forbidden = ['email', 'phone', 'passwordHash', 'verificationToken', 'resetPasswordToken', 'studentId', 'isVerified'];
    const sellerKeys = sellerInfo ? Object.keys(sellerInfo) : [];
    const serialized = JSON.stringify(sellerInfo || {});
    return (
      savedProduct?.title === 'Phase 6 Lab Notebook' &&
      savedProduct?.price === 250 &&
      Array.isArray(savedProduct?.images) &&
      savedProduct?.condition === 'good' &&
      savedProduct?.listingType === 'sell' &&
      savedProduct?.status === 'available' &&
      savedProduct?.campusLocation === 'FST Lab 402' &&
      sellerInfo?.name === 'Phase6 Seller' &&
      forbidden.every((field) => !sellerKeys.includes(field)) &&
      !serialized.includes(emails[0]) &&
      !serialized.includes('+8801711111111')
    );
  });

  await runCase(7, 'Remove wishlist item', async () => {
    const res = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'DELETE',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const count = await Wishlist.countDocuments({ user: buyer._id, product: product._id });
    const missing = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'DELETE',
      headers: authHeaders(buyerToken),
    });
    return res.status === 200 && data.data?.removed === true && count === 0 && missing.status === 200;
  });

  await runCase(8, 'Check wishlist status', async () => {
    const before = await fetch(`${BASE}/wishlist/check/${product._id}`, { headers: authHeaders(buyerToken) });
    const beforeData = await before.json();
    await fetch(`${BASE}/wishlist/${product._id}`, { method: 'POST', headers: authHeaders(buyerToken) });
    const after = await fetch(`${BASE}/wishlist/check/${product._id}`, { headers: authHeaders(buyerToken) });
    const afterData = await after.json();
    return before.status === 200 && beforeData.data?.wishlisted === false && after.status === 200 && afterData.data?.wishlisted === true;
  });

  await runCase(9, "User cannot access another user's wishlist", async () => {
    const otherList = await fetch(`${BASE}/wishlist`, { headers: authHeaders(otherToken) });
    const otherData = await otherList.json();
    const otherHasIt = (otherData.data?.items || []).some((item) => item.product?._id === product._id.toString());

    const removeAttempt = await fetch(`${BASE}/wishlist/${product._id}`, {
      method: 'DELETE',
      headers: authHeaders(otherToken),
    });
    const buyerStillHasIt = await Wishlist.exists({ user: buyer._id, product: product._id });

    return otherList.status === 200 && otherHasIt === false && removeAttempt.status === 200 && Boolean(buyerStillHasIt);
  });

  await runCase(10, 'Invalid product ObjectId handled safely', async () => {
    const res = await fetch(`${BASE}/wishlist/not-an-id`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const check = await fetch(`${BASE}/wishlist/check/not-an-id`, { headers: authHeaders(buyerToken) });
    return res.status === 400 && data.success === false && check.status === 400;
  });

  await runCase(11, 'Nonexistent product handled safely', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${BASE}/wishlist/${missingId}`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    return res.status === 404 && data.success === false;
  });

  await runCase(12, 'Notification can be created', async () => {
    const created = await createNotification({
      recipient: buyer._id,
      type: 'SYSTEM',
      title: 'Phase 6 system note',
      message: 'Notification service created this record.',
    });
    const invalid = await createNotification({ title: 'missing fields' });
    return Boolean(created?._id) && invalid === null;
  });

  await runCase(13, "Get current user's notifications", async () => {
    const res = await fetch(`${BASE}/notifications`, { headers: authHeaders(buyerToken) });
    const data = await res.json();
    const notes = data.data?.notifications || [];
    const otherRes = await fetch(`${BASE}/notifications`, { headers: authHeaders(otherToken) });
    const otherData = await otherRes.json();
    return (
      res.status === 200 &&
      notes.some((note) => note.title === 'Phase 6 system note' && note.recipient === buyer._id.toString()) &&
      (otherData.data?.notifications || []).every((note) => note.recipient === other._id.toString())
    );
  });

  await runCase(14, 'Pagination works', async () => {
    for (let index = 0; index < 4; index += 1) {
      await createNotification({
        recipient: buyer._id,
        type: 'SYSTEM',
        title: `Phase 6 page note ${index}`,
        message: `Pagination message ${index}`,
      });
    }

    const pageRes = await fetch(`${BASE}/notifications?page=1&limit=2`, { headers: authHeaders(buyerToken) });
    const pageData = await pageRes.json();
    const notes = pageData.data?.notifications || [];
    const times = notes.map((note) => new Date(note.createdAt).getTime());
    const newestFirst = times.every((time, index) => index === 0 || times[index - 1] >= time);

    const boundedRes = await fetch(`${BASE}/notifications?limit=500`, { headers: authHeaders(buyerToken) });
    const boundedData = await boundedRes.json();

    return (
      pageRes.status === 200 &&
      notes.length === 2 &&
      pageData.data?.pagination?.page === 1 &&
      pageData.data?.pagination?.limit === 2 &&
      pageData.data?.pagination?.hasNextPage === true &&
      pageData.data?.pagination?.totalItems >= 5 &&
      newestFirst &&
      boundedData.data?.pagination?.limit === 50
    );
  });

  await runCase(15, 'Unread count works', async () => {
    const expected = await Notification.countDocuments({ recipient: buyer._id, isRead: false });
    const res = await fetch(`${BASE}/notifications/unread-count`, { headers: authHeaders(buyerToken) });
    const data = await res.json();
    const unauth = await fetch(`${BASE}/notifications/unread-count`);
    return res.status === 200 && data.data?.count === expected && expected > 0 && unauth.status === 401;
  });

  await runCase(16, 'Mark one notification as read', async () => {
    const before = await Notification.countDocuments({ recipient: buyer._id, isRead: false });
    const target = await Notification.findOne({ recipient: buyer._id, isRead: false }).sort({ createdAt: -1 });
    const res = await fetch(`${BASE}/notifications/${target._id}/read`, {
      method: 'PATCH',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const updated = await Notification.findById(target._id);
    const after = await Notification.countDocuments({ recipient: buyer._id, isRead: false });
    const countRes = await fetch(`${BASE}/notifications/unread-count`, { headers: authHeaders(buyerToken) });
    const countData = await countRes.json();
    return res.status === 200 && data.data?.isRead === true && updated.isRead === true && after === before - 1 && countData.data?.count === after;
  });

  await runCase(17, 'Mark all notifications as read', async () => {
    const res = await fetch(`${BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const remaining = await Notification.countDocuments({ recipient: buyer._id, isRead: false });
    const countRes = await fetch(`${BASE}/notifications/unread-count`, { headers: authHeaders(buyerToken) });
    const countData = await countRes.json();
    return res.status === 200 && data.success === true && remaining === 0 && countData.data?.count === 0;
  });

  await runCase(18, 'Delete own notification', async () => {
    const target = await Notification.findOne({ recipient: buyer._id });
    const res = await fetch(`${BASE}/notifications/${target._id}`, {
      method: 'DELETE',
      headers: authHeaders(buyerToken),
    });
    const data = await res.json();
    const stillThere = await Notification.findById(target._id);
    return res.status === 200 && data.success === true && stillThere === null;
  });

  await runCase(19, "Cannot modify another user's notification", async () => {
    const owned = await createNotification({
      recipient: buyer._id,
      type: 'SYSTEM',
      title: 'Private buyer note',
      message: 'Only the buyer can change this notification.',
    });
    const readAttempt = await fetch(`${BASE}/notifications/${owned._id}/read`, {
      method: 'PATCH',
      headers: authHeaders(otherToken),
    });
    const deleteAttempt = await fetch(`${BASE}/notifications/${owned._id}`, {
      method: 'DELETE',
      headers: authHeaders(otherToken),
    });
    const unchanged = await Notification.findById(owned._id);
    return readAttempt.status === 403 && deleteAttempt.status === 403 && unchanged?.isRead === false;
  });

  await runCase(20, 'Invalid notification ObjectId handled safely', async () => {
    const readRes = await fetch(`${BASE}/notifications/not-an-id/read`, {
      method: 'PATCH',
      headers: authHeaders(buyerToken),
    });
    const deleteRes = await fetch(`${BASE}/notifications/not-an-id`, {
      method: 'DELETE',
      headers: authHeaders(buyerToken),
    });
    return readRes.status === 400 && deleteRes.status === 400;
  });

  const calculator = await Product.create({
    title: 'Scientific Calculator',
    description: 'Wishlist availability notification listing.',
    category: category._id,
    seller: seller._id,
    listingType: 'sell',
    price: 1800,
    condition: 'like-new',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'available',
  });

  await fetch(`${BASE}/wishlist/${calculator._id}`, { method: 'POST', headers: authHeaders(buyerToken) });

  await runCase(21, 'available → sold creates wishlist notification', async () => {
    const before = await Notification.countDocuments({
      recipient: buyer._id,
      relatedProduct: calculator._id,
      type: 'WISHLIST_PRODUCT_SOLD',
    });
    const res = await fetch(`${BASE}/products/${calculator._id}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerToken, true),
      body: JSON.stringify({ status: 'sold' }),
    });
    const data = await res.json();
    const again = await fetch(`${BASE}/products/${calculator._id}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerToken, true),
      body: JSON.stringify({ status: 'sold' }),
    });
    const notes = await Notification.find({
      recipient: buyer._id,
      relatedProduct: calculator._id,
      type: 'WISHLIST_PRODUCT_SOLD',
    }).lean();

    return (
      res.status === 200 &&
      data.data?.status === 'sold' &&
      again.status === 200 &&
      before === 0 &&
      notes.length === 1 &&
      notes[0].title === 'Wishlist item unavailable' &&
      notes[0].message === "The product 'Scientific Calculator' is no longer available." &&
      notes[0].link === `/products/${calculator._id}`
    );
  });

  const inactiveProduct = await Product.create({
    title: 'Drawing Board',
    description: 'Inactive wishlist notification listing.',
    category: category._id,
    seller: seller._id,
    listingType: 'sell',
    price: 700,
    condition: 'good',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'available',
  });
  await fetch(`${BASE}/wishlist/${inactiveProduct._id}`, { method: 'POST', headers: authHeaders(buyerToken) });

  await runCase(22, 'available → inactive creates wishlist notification', async () => {
    const res = await fetch(`${BASE}/products/${inactiveProduct._id}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerToken, true),
      body: JSON.stringify({ status: 'inactive' }),
    });
    const note = await Notification.findOne({
      recipient: buyer._id,
      relatedProduct: inactiveProduct._id,
      type: 'WISHLIST_PRODUCT_UNAVAILABLE',
    }).lean();
    return res.status === 200 && note?.message === "The product 'Drawing Board' is no longer available.";
  });

  await runCase(23, 'Non-wishlisted users do not receive irrelevant notification', async () => {
    const otherNotes = await Notification.find({
      recipient: other._id,
      relatedProduct: { $in: [calculator._id, inactiveProduct._id] },
    });
    const sellerNotes = await Notification.find({
      recipient: seller._id,
      relatedProduct: { $in: [calculator._id, inactiveProduct._id] },
    });
    return otherNotes.length === 0 && sellerNotes.length === 0;
  });

  const failureProduct = await Product.create({
    title: 'Failure Isolation Lamp',
    description: 'Status update must survive notification failure.',
    category: category._id,
    seller: seller._id,
    listingType: 'sell',
    price: 400,
    condition: 'fair',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'available',
  });
  await fetch(`${BASE}/wishlist/${failureProduct._id}`, { method: 'POST', headers: authHeaders(buyerToken) });

  await runCase(24, 'Notification failure does not unnecessarily break product status update', async () => {
    const notifications = mongoose.connection.db.collection('notifications');
    await notifications.dropIndexes().catch(() => {});
    await mongoose.connection.db.command({
      collMod: 'notifications',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['__phase6_force_fail'],
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    try {
      const res = await fetch(`${BASE}/products/${failureProduct._id}/status`, {
        method: 'PATCH',
        headers: authHeaders(sellerToken, true),
        body: JSON.stringify({ status: 'sold' }),
      });
      const data = await res.json();
      const saved = await Product.findById(failureProduct._id);
      const notes = await Notification.countDocuments({ relatedProduct: failureProduct._id });
      return res.status === 200 && data.success === true && saved.status === 'sold' && notes === 0;
    } finally {
      await mongoose.connection.db.command({
        collMod: 'notifications',
        validator: { $jsonSchema: { bsonType: 'object' } },
        validationLevel: 'off',
      });
      await Notification.syncIndexes();
    }
  });

  await runCase(25, 'Health endpoint works', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return res.status === 200 && data.success === true && data.data?.database?.connected === true;
  });

  await mongoose.disconnect();

  const phase2 = await runRegression('phase2Validation.js');
  record(26, 'Phase 2 tests', phase2.ok);

  const phase3 = await runRegression('phase3Validation.js');
  record(27, 'Phase 3 tests', phase3.ok);

  const phase4 = await runRegression('phase4Validation.js');
  record(28, 'Phase 4 tests', phase4.ok);

  const phase5 = await runRegression('phase5Validation.js');
  record(29, 'Phase 5 tests', phase5.ok);

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 6 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed tests: ${failed.map((item) => item.id).join(', ')}`);
  }
  console.log(failed.length ? '--- PHASE 6 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 6 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase6Validation().catch(async (error) => {
  console.error('Phase 6 test suite failed:', error);
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.command({
        collMod: 'notifications',
        validator: { $jsonSchema: { bsonType: 'object' } },
        validationLevel: 'off',
      });
    }
  } catch {
    // Validator cleanup is best-effort if the suite crashes early.
  }
  process.exit(1);
});
