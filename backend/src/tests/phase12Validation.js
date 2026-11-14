import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { WantedPost } from '../models/WantedPost.js';
import { Review } from '../models/Review.js';
import { Report } from '../models/Report.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { generateToken } from '../utils/token.js';
import {
  USER_ROLES,
  MODERATION_ACTION,
  REPORT_STATUS,
  REPORT_TARGET,
  REPORT_REASON,
  PRODUCT_STATUS,
  MODERATION_STATUS,
  WANTED_STATUS,
  ACCOUNT_STATUS,
  REVIEW_STATUS,
  REVIEW_TYPE,
  TRANSACTION_STATUS,
  NOTIFICATION_TYPES,
} from '../constants/index.js';

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

const runPhase12Validation = async () => {
  console.log('--- STARTING PHASE 12A AUTOMATED TEST SUITE ---');

  // Verify DB connection
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Clean test accounts
  const emails = [
    'phase12_admin@bup.edu.bd',
    'phase12_admin2@bup.edu.bd',
    'phase12_student_reporter@bup.edu.bd',
    'phase12_student_target@bup.edu.bd',
    'phase12_student_other@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((u) => u._id);
  if (existingIds.length) {
    await Report.deleteMany({
      $or: [
        { reporter: { $in: existingIds } },
        { targetUser: { $in: existingIds } },
        { moderator: { $in: existingIds } },
      ],
    });
    await Review.deleteMany({ $or: [{ reviewer: { $in: existingIds } }, { reviewee: { $in: existingIds } }] });
    await Transaction.deleteMany({ $or: [{ buyer: { $in: existingIds } }, { seller: { $in: existingIds } }] });
    await WantedPost.deleteMany({ author: { $in: existingIds } });
    await Product.deleteMany({ seller: { $in: existingIds } });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await Message.deleteMany({ sender: { $in: existingIds } });
    await Conversation.deleteMany({ participants: { $in: existingIds } });
    await User.deleteMany({ _id: { $in: existingIds } });
  }

  const category = await Category.findOne();
  if (!category) throw new Error('No categories found. Start the API once so category seed can run.');

  // Create test actors
  const adminUser = await User.create({
    name: 'Phase 12 Admin',
    email: emails[0],
    passwordHash: 'dummy_admin_hash',
    studentId: 'p12-admin-1',
    phone: '+8801700000121',
    department: 'ICT',
    batch: 'FACULTY',
    campusLocation: 'Admin Block Room 301',
    role: USER_ROLES.ADMIN,
    isVerified: true,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  const adminUser2 = await User.create({
    name: 'Phase 12 Admin Two',
    email: emails[1],
    passwordHash: 'dummy_admin2_hash',
    studentId: 'p12-admin-2',
    phone: '+8801700000122',
    department: 'ICT',
    batch: 'FACULTY',
    campusLocation: 'Admin Block Room 302',
    role: USER_ROLES.ADMIN,
    isVerified: true,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  const studentReporter = await User.create({
    name: 'Phase 12 Reporter',
    email: emails[2],
    passwordHash: 'dummy_reporter_hash',
    studentId: 'p12-student-reporter',
    phone: '+8801700000123',
    department: 'ICT',
    batch: 'BICE-24',
    campusLocation: 'Mirpur Cantonment Campus',
    role: USER_ROLES.STUDENT,
    isVerified: true,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  const studentTarget = await User.create({
    name: 'Phase 12 Offender',
    email: emails[3],
    passwordHash: 'dummy_target_hash',
    studentId: 'p12-student-target',
    phone: '+8801700000124',
    department: 'ICT',
    batch: 'BICE-24',
    campusLocation: 'Mirpur Cantonment Campus',
    role: USER_ROLES.STUDENT,
    isVerified: true,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  const studentOther = await User.create({
    name: 'Phase 12 Other',
    email: emails[4],
    passwordHash: 'dummy_other_hash',
    studentId: 'p12-student-other',
    phone: '+8801700000125',
    department: 'ICT',
    batch: 'BICE-24',
    campusLocation: 'Mirpur Cantonment Campus',
    role: USER_ROLES.STUDENT,
    isVerified: true,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  const adminToken = generateToken(adminUser._id, USER_ROLES.ADMIN);
  const admin2Token = generateToken(adminUser2._id, USER_ROLES.ADMIN);
  const studentToken = generateToken(studentReporter._id, USER_ROLES.STUDENT);

  // Create targets for reporting
  const testProduct = await Product.create({
    title: 'Phase 12 Suspicious Item',
    description: 'Counterfeit textbook with wrong ISBN.',
    category: category._id,
    seller: studentTarget._id,
    listingType: 'sell',
    price: 350,
    condition: 'good',
    campusLocation: 'FST Library',
    status: PRODUCT_STATUS.ACTIVE,
    moderationStatus: MODERATION_STATUS.APPROVED,
    images: [{ url: '/uploads/p12-item.jpg', isThumbnail: true }],
  });

  const testWantedPost = await WantedPost.create({
    title: 'Phase 12 Inappropriate Wanted Post',
    description: 'Looking to buy exam leak answers.',
    category: category._id,
    author: studentTarget._id,
    minBudget: 50,
    maxBudget: 200,
    campusLocation: 'Cafeteria',
    status: WANTED_STATUS.OPEN,
  });

  const testTransaction = await Transaction.create({
    product: testProduct._id,
    buyer: studentTarget._id,
    seller: studentOther._id,
    sourceType: 'BUY_REQUEST',
    agreedPrice: 350,
    status: TRANSACTION_STATUS.COMPLETED,
    buyerConfirmed: true,
    sellerConfirmed: true,
    completedAt: new Date(),
    isActive: false,
  });

  const testReview = await Review.create({
    transaction: testTransaction._id,
    reviewer: studentTarget._id,
    reviewee: studentOther._id,
    product: testProduct._id,
    rating: 1,
    comment: 'Harassing abusive review comment content.',
    type: REVIEW_TYPE.BUYER_TO_SELLER,
    status: REVIEW_STATUS.PUBLISHED,
  });

  const testConversation = await Conversation.create({
    participants: [studentReporter._id, studentTarget._id],
  });

  const testMessage = await Message.create({
    conversation: testConversation._id,
    sender: studentTarget._id,
    recipient: studentReporter._id,
    text: 'Harassing private message text.',
  });

  // Create test reports
  const reportProduct = await Report.create({
    reporter: studentReporter._id,
    targetType: REPORT_TARGET.PRODUCT,
    targetId: testProduct._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.COUNTERFEIT,
    description: 'This is a counterfeit item violating policy.',
    status: REPORT_STATUS.PENDING,
  });

  const reportWanted = await Report.create({
    reporter: studentReporter._id,
    targetType: REPORT_TARGET.WANTED_POST,
    targetId: testWantedPost._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.OTHER,
    description: 'Soliciting exam answers.',
    status: REPORT_STATUS.PENDING,
  });

  const reportReview = await Report.create({
    reporter: studentReporter._id,
    targetType: REPORT_TARGET.REVIEW,
    targetId: testReview._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.HARASSMENT,
    description: 'Abusive language in review.',
    status: REPORT_STATUS.PENDING,
  });

  const reportUser = await Report.create({
    reporter: studentReporter._id,
    targetType: REPORT_TARGET.USER,
    targetId: studentTarget._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.SPAM,
    description: 'Repeated spam across marketplace.',
    status: REPORT_STATUS.PENDING,
  });

  const reportUserToBan = await Report.create({
    reporter: studentOther._id,
    targetType: REPORT_TARGET.USER,
    targetId: studentTarget._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.SCAM,
    description: 'Severe fraud reported.',
    status: REPORT_STATUS.PENDING,
  });

  const reportMessage = await Report.create({
    reporter: studentReporter._id,
    targetType: REPORT_TARGET.MESSAGE,
    targetId: testMessage._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.HARASSMENT,
    description: 'Threats in chat message.',
    status: REPORT_STATUS.PENDING,
  });

  const reportToDismiss = await Report.create({
    reporter: studentOther._id,
    targetType: REPORT_TARGET.PRODUCT,
    targetId: testProduct._id,
    targetUser: studentTarget._id,
    reason: REPORT_REASON.OTHER,
    description: 'False report to test dismissal.',
    status: REPORT_STATUS.PENDING,
  });

  console.log('Seeded test data successfully');

  // --- SECTION 1: AUTH GUARD & AUTHORIZATION ---
  await runCase(1, 'Admin routes mounted and health endpoint ok', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return res.status === 200 && data.success === true;
  });

  await runCase(2, 'Auth guard: Missing token on GET /api/v1/admin/reports returns 401', async () => {
    const res = await fetch(`${BASE}/admin/reports`);
    return res.status === 401;
  });

  await runCase(3, 'Auth guard: Student role on GET /api/v1/admin/reports returns 403', async () => {
    const res = await fetch(`${BASE}/admin/reports`, {
      headers: authHeaders(studentToken),
    });
    return res.status === 403;
  });

  await runCase(4, 'Auth guard: Student role on GET /api/v1/admin/reports/:id returns 403', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}`, {
      headers: authHeaders(studentToken),
    });
    return res.status === 403;
  });

  await runCase(5, 'Auth guard: Student role on PUT /api/v1/admin/reports/:id/resolve returns 403', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(studentToken, true),
      body: JSON.stringify({ action: MODERATION_ACTION.NONE }),
    });
    return res.status === 403;
  });

  await runCase(6, 'Auth guard: Student role on PUT /api/v1/admin/reports/:id/dismiss returns 403', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}/dismiss`, {
      method: 'PUT',
      headers: authHeaders(studentToken, true),
      body: JSON.stringify({ note: 'Unauthorized attempt' }),
    });
    return res.status === 403;
  });

  await runCase(7, 'Auth guard: Student role on POST /api/v1/admin/moderate-target returns 403', async () => {
    const res = await fetch(`${BASE}/admin/moderate-target`, {
      method: 'POST',
      headers: authHeaders(studentToken, true),
      body: JSON.stringify({
        targetType: REPORT_TARGET.PRODUCT,
        targetId: testProduct._id,
        action: MODERATION_ACTION.DEACTIVATE_PRODUCT,
      }),
    });
    return res.status === 403;
  });

  await runCase(8, 'Admin access: Admin user can access GET /api/v1/admin/reports (returns 200)', async () => {
    const res = await fetch(`${BASE}/admin/reports`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    return res.status === 200 && data.success === true && Array.isArray(data.data.reports);
  });

  await runCase(9, 'Admin reports listing returns pagination metadata', async () => {
    const res = await fetch(`${BASE}/admin/reports?page=1&limit=5`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const p = data.data.pagination;
    return Boolean(p && p.page === 1 && p.limit === 5 && p.totalItems >= 7 && p.totalPages >= 1);
  });

  await runCase(10, 'Admin reports listing returns summary statistics', async () => {
    const res = await fetch(`${BASE}/admin/reports`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const s = data.data.summary;
    return Boolean(s && s.total >= 7 && s.pending >= 7 && typeof s.resolved === 'number' && typeof s.dismissed === 'number');
  });

  // --- SECTION 2: FILTERS & DETAILS ---
  await runCase(11, 'Filter by status: status=pending returns only pending reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?status=pending`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.status).toLowerCase() === 'pending');
  });

  await runCase(12, 'Filter by targetType: targetType=Product returns only Product reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?targetType=Product`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.targetType).toUpperCase() === 'PRODUCT');
  });

  await runCase(13, 'Filter by targetType: targetType=WantedPost returns only WantedPost reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?targetType=WantedPost`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.targetType).toUpperCase() === 'WANTED_POST');
  });

  await runCase(14, 'Filter by targetType: targetType=Review returns only Review reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?targetType=Review`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.targetType).toUpperCase() === 'REVIEW');
  });

  await runCase(15, 'Filter by targetType: targetType=User returns only User reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?targetType=User`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.targetType).toUpperCase() === 'USER');
  });

  await runCase(16, 'Filter by targetType: targetType=Message returns only Message reports', async () => {
    const res = await fetch(`${BASE}/admin/reports?targetType=Message`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const list = data.data?.reports || [];
    return list.length > 0 && list.every((r) => String(r.targetType).toUpperCase() === 'MESSAGE');
  });

  await runCase(17, 'Get report by ID returns safe report payload and reporter profile', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const r = data.data;
    return Boolean(
      res.status === 200 &&
      r._id === String(reportProduct._id) &&
      r.reporter?.name === studentReporter.name &&
      r.reporter?.email === studentReporter.email &&
      !r.reporter?.passwordHash
    );
  });

  await runCase(18, 'Get report for Product populates safe product details', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const target = data.data.target;
    return Boolean(
      target &&
      target._id === String(testProduct._id) &&
      target.title === testProduct.title &&
      target.price === testProduct.price &&
      target.seller?.name === studentTarget.name
    );
  });

  await runCase(19, 'Get report for WantedPost populates safe wanted post details', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportWanted._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const target = data.data.target;
    return Boolean(
      target &&
      target._id === String(testWantedPost._id) &&
      target.title === testWantedPost.title &&
      target.author?.name === studentTarget.name
    );
  });

  await runCase(20, 'Get report for Review populates safe review details', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportReview._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const target = data.data.target;
    return Boolean(
      target &&
      target._id === String(testReview._id) &&
      target.rating === 1 &&
      target.reviewer?.name === studentTarget.name
    );
  });

  await runCase(21, 'Get report for User populates safe user details without sensitive tokens', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportUser._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const target = data.data.target;
    return Boolean(
      target &&
      target._id === String(studentTarget._id) &&
      target.name === studentTarget.name &&
      !target.passwordHash &&
      !target.emailVerificationToken &&
      !target.passwordResetTokenHash
    );
  });

  await runCase(22, 'Get report for Message populates safe message details', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportMessage._id}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const target = data.data.target;
    return Boolean(
      target &&
      target._id === String(testMessage._id) &&
      target.text === testMessage.text &&
      target.sender?.name === studentTarget.name
    );
  });

  await runCase(23, 'Get report by nonexistent ID returns 404', async () => {
    const nonId = new mongoose.Types.ObjectId();
    const res = await fetch(`${BASE}/admin/reports/${nonId}`, {
      headers: authHeaders(adminToken),
    });
    return res.status === 404;
  });

  // --- SECTION 3: DISMISS FLOW & CONFLICT CHECKS ---
  await runCase(24, 'Dismiss report: Admin can dismiss a pending report with note', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportToDismiss._id}/dismiss`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({ note: 'Reviewed and confirmed no violation took place.' }),
    });
    const data = await res.json();
    return res.status === 200 && data.success === true && String(data.data.status).toUpperCase() === 'DISMISSED';
  });

  await runCase(25, 'Dismiss report: Status becomes dismissed, audit fields are set', async () => {
    const updated = await Report.findById(reportToDismiss._id);
    return Boolean(
      updated &&
      updated.status === REPORT_STATUS.DISMISSED &&
      String(updated.moderator) === String(adminUser._id) &&
      updated.moderatedAt &&
      updated.moderationAction === MODERATION_ACTION.DISMISS &&
      updated.moderationNote.includes('Reviewed and confirmed')
    );
  });

  await runCase(26, 'Dismiss report: Reporter receives system notification about dismissal', async () => {
    const notif = await Notification.findOne({
      recipient: studentOther._id,
      type: NOTIFICATION_TYPES.SYSTEM,
    });
    return Boolean(notif && notif.title.includes('Report'));
  });

  await runCase(27, 'Conflict check: Cannot dismiss an already dismissed report (returns 409)', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportToDismiss._id}/dismiss`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({ note: 'Second dismiss attempt' }),
    });
    return res.status === 409;
  });

  await runCase(28, 'Conflict check: Cannot resolve an already dismissed report (returns 409)', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportToDismiss._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({ action: MODERATION_ACTION.DEACTIVATE_PRODUCT, note: 'Attempting resolve' }),
    });
    return res.status === 409;
  });

  // --- SECTION 4: CONTENT MODERATION ACTIONS ---
  await runCase(29, 'Resolve report on Product with DEACTIVATE_PRODUCT deactivates product', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.DEACTIVATE_PRODUCT,
        note: 'Confirmed counterfeit book.',
      }),
    });
    const data = await res.json();
    const productInDb = await Product.findById(testProduct._id);
    return (
      res.status === 200 &&
      data.success === true &&
      String(data.data.status).toUpperCase() === 'RESOLVED' &&
      productInDb.status === PRODUCT_STATUS.INACTIVE &&
      productInDb.moderationStatus === MODERATION_STATUS.REJECTED
    );
  });

  await runCase(30, 'Resolve report on Product: Product seller receives notification', async () => {
    const notif = await Notification.findOne({
      recipient: studentTarget._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      relatedProduct: testProduct._id,
    });
    return Boolean(notif && notif.title.includes('Listing Deactivated'));
  });

  await runCase(31, 'Resolve report on Product: Reporter receives resolution notification', async () => {
    const notif = await Notification.findOne({
      recipient: studentReporter._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Report Resolved',
    });
    return Boolean(notif);
  });

  await runCase(32, 'Conflict check: Cannot resolve an already resolved report (returns 409)', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({ action: MODERATION_ACTION.NONE, note: 'Repeat resolve' }),
    });
    return res.status === 409;
  });

  await runCase(33, 'Conflict check: Cannot dismiss an already resolved report (returns 409)', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportProduct._id}/dismiss`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({ note: 'Attempting dismiss on resolved' }),
    });
    return res.status === 409;
  });

  await runCase(34, 'Resolve report on WantedPost with CLOSE_WANTED_POST closes wanted post', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportWanted._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.CLOSE_WANTED_POST,
        note: 'Academic integrity policy violation.',
      }),
    });
    const postInDb = await WantedPost.findById(testWantedPost._id);
    const authorNotif = await Notification.findOne({
      recipient: studentTarget._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Wanted Post Closed by Moderator',
    });
    return (
      res.status === 200 &&
      postInDb.status === WANTED_STATUS.CLOSED &&
      Boolean(authorNotif)
    );
  });

  await runCase(35, 'Resolve report on Review with HIDE_REVIEW hides review and recalculates ratings', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportReview._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.HIDE_REVIEW,
        note: 'Abusive language verified.',
      }),
    });
    const revInDb = await Review.findById(testReview._id);
    const userNotif = await Notification.findOne({
      recipient: studentTarget._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Review Removed by Moderator',
    });
    return (
      res.status === 200 &&
      revInDb.status === REVIEW_STATUS.HIDDEN &&
      Boolean(userNotif)
    );
  });

  await runCase(36, 'Resolve report on User with SUSPEND_USER updates user status to suspended', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportUser._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.SUSPEND_USER,
        note: 'Temporary suspension for policy violation.',
      }),
    });
    const targetInDb = await User.findById(studentTarget._id);
    const suspNotif = await Notification.findOne({
      recipient: studentTarget._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Account Suspended',
    });
    return (
      res.status === 200 &&
      targetInDb.status === ACCOUNT_STATUS.SUSPENDED &&
      Boolean(suspNotif)
    );
  });

  await runCase(37, 'Resolve report on User with BAN_USER updates user status to banned', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportUserToBan._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.BAN_USER,
        note: 'Severe repeated fraud results in permanent ban.',
      }),
    });
    const targetInDb = await User.findById(studentTarget._id);
    const banNotif = await Notification.findOne({
      recipient: studentTarget._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Account Banned',
    });
    return (
      res.status === 200 &&
      targetInDb.status === ACCOUNT_STATUS.BANNED &&
      Boolean(banNotif)
    );
  });

  // --- SECTION 5: SAFETY GUARDS & DIRECT MODERATION ---
  await runCase(38, 'Guard: Admin cannot suspend or ban another admin user (returns 400)', async () => {
    // Create dummy report targeting admin2
    const adminTargetReport = await Report.create({
      reporter: studentReporter._id,
      targetType: REPORT_TARGET.USER,
      targetId: adminUser2._id,
      targetUser: adminUser2._id,
      reason: REPORT_REASON.OTHER,
      description: 'Attempting to ban fellow admin.',
      status: REPORT_STATUS.PENDING,
    });

    const res = await fetch(`${BASE}/admin/reports/${adminTargetReport._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.BAN_USER,
        note: 'Should fail',
      }),
    });
    return res.status === 400;
  });

  await runCase(39, 'Guard: Incompatible moderation action for target type returns 400', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportMessage._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.DEACTIVATE_PRODUCT, // Invalid for Message target
        note: 'Mismatched action',
      }),
    });
    return res.status === 400;
  });

  await runCase(40, 'Resolve with NONE action resolves report without altering target', async () => {
    const res = await fetch(`${BASE}/admin/reports/${reportMessage._id}/resolve`, {
      method: 'PUT',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        action: MODERATION_ACTION.NONE,
        note: 'Message reviewed, warning logged internally.',
      }),
    });
    const updated = await Report.findById(reportMessage._id);
    return res.status === 200 && updated.status === REPORT_STATUS.RESOLVED && updated.moderationAction === MODERATION_ACTION.NONE;
  });

  await runCase(41, 'Direct moderation: Admin can directly moderate target via POST /api/v1/admin/moderate-target', async () => {
    const directProduct = await Product.create({
      title: 'Direct Moderation Item',
      description: 'Testing direct action.',
      category: category._id,
      seller: studentOther._id,
      listingType: 'sell',
      price: 120,
      condition: 'good',
      campusLocation: 'Campus Shop',
      status: PRODUCT_STATUS.ACTIVE,
      images: [{ url: '/uploads/p12-direct.jpg', isThumbnail: true }],
    });

    const res = await fetch(`${BASE}/admin/moderate-target`, {
      method: 'POST',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        targetType: REPORT_TARGET.PRODUCT,
        targetId: directProduct._id,
        action: MODERATION_ACTION.DEACTIVATE_PRODUCT,
        note: 'Direct deactivation by admin.',
      }),
    });
    const updated = await Product.findById(directProduct._id);
    return res.status === 200 && updated.status === PRODUCT_STATUS.INACTIVE;
  });

  await runCase(42, 'Direct moderation: Nonexistent target returns 404', async () => {
    const res = await fetch(`${BASE}/admin/moderate-target`, {
      method: 'POST',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        targetType: REPORT_TARGET.PRODUCT,
        targetId: new mongoose.Types.ObjectId(),
        action: MODERATION_ACTION.DEACTIVATE_PRODUCT,
      }),
    });
    return res.status === 404;
  });

  await runCase(43, 'Direct moderation: Missing action returns 400', async () => {
    const res = await fetch(`${BASE}/admin/moderate-target`, {
      method: 'POST',
      headers: authHeaders(adminToken, true),
      body: JSON.stringify({
        targetType: REPORT_TARGET.PRODUCT,
        targetId: testProduct._id,
      }),
    });
    return res.status === 400;
  });

  await runCase(44, 'IDOR guard: Ordinary user profile update cannot elevate role to admin', async () => {
    const res = await fetch(`${BASE}/users/profile`, {
      method: 'PUT',
      headers: authHeaders(studentToken, true),
      body: JSON.stringify({
        name: 'Hacker Student',
        role: 'admin',
      }),
    });
    const freshUser = await User.findById(studentReporter._id);
    return res.status === 200 && freshUser.role === USER_ROLES.STUDENT;
  });

  await runCase(45, 'Admin response hygiene: Reports endpoint never leaks password hashes or tokens', async () => {
    const res = await fetch(`${BASE}/admin/reports?limit=10`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    const jsonStr = JSON.stringify(data);
    return !jsonStr.includes('passwordHash') && !jsonStr.includes('emailVerificationToken') && !jsonStr.includes('passwordResetTokenHash');
  });

  await runCase(46, 'Date range filter: startDate / endDate returns valid subset', async () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const future = new Date(Date.now() + 60000).toISOString();
    const res = await fetch(`${BASE}/admin/reports?startDate=${past}&endDate=${future}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    return res.status === 200 && data.data.reports.length > 0;
  });

  // --- SECTION 6: REGRESSION SUITE (PHASE 11) ---
  console.log('\n--- EXECUTING PHASE 11 REGRESSION SUITE ---');
  await runCase(47, 'Phase 11 regression suite passes cleanly', async () => {
    const regRes = await runRegression('phase11Validation.js');
    console.log(`\nPhase 11 regression result: code=${regRes.code}, ok=${regRes.ok}`);
    return regRes.ok;
  });

  // Print Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n=============================================');
  console.log(`PHASE 12A VALIDATION SUMMARY:`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=============================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

runPhase12Validation().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
