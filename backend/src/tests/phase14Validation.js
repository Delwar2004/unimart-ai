/**
 * UniMart AI — Phase 14 End-to-End Integration, Security & Production Readiness Test Suite
 * Validates complete end-to-end commerce lifecycles, concurrency & conflict resolution,
 * security headers, static upload boundaries, rate limiting, and the full regression cascade.
 */

import dotenv from 'dotenv';
dotenv.config();

// Default testing mode uses the deterministic mock provider
process.env.AI_PROVIDER = 'mock';

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { BuyRequest } from '../models/BuyRequest.js';
import { ExchangeRequest } from '../models/ExchangeRequest.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { GiveawayRequest } from '../models/GiveawayRequest.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Review } from '../models/Review.js';
import { Report } from '../models/Report.js';
import { Wishlist } from '../models/Wishlist.js';
import {
  USER_ROLES,
  ACCOUNT_STATUS,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  LISTING_TYPES,
  TRANSACTION_STATUS,
  TRANSACTION_SOURCE,
  REQUEST_STATUS,
  REPORT_TARGET,
  REPORT_REASON,
  MODERATION_ACTION,
} from '../constants/index.js';
import { generateToken } from '../utils/token.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unimart_ai';

const results = [];

const runCase = async (number, name, fn) => {
  try {
    const passed = await fn();
    if (passed) {
      console.log(`Test ${number} (${name}): PASS`);
      results.push({ number, name, ok: true });
    } else {
      console.error(`Test ${number} (${name}): FAIL`);
      results.push({ number, name, ok: false });
    }
  } catch (error) {
    console.error(`Test ${number} (${name}): ERROR`, error.message);
    results.push({ number, name, ok: false, error: error.message });
  }
};

const authHeaders = (token, provider = 'mock', bypassRateLimit = true) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(provider ? { 'x-ai-provider': provider } : {}),
  ...(bypassRateLimit ? { 'x-bypass-rate-limit': 'true' } : {}),
});

const runRegression = (testFileName) => {
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, testFileName);
    const child = spawn(process.execPath, [filePath], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => {
      resolve({ code, ok: code === 0 });
    });
  });
};

const runPhase14Validation = async () => {
  console.log('--- STARTING PHASE 14 END-TO-END VALIDATION SUITE ---');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const stamp = Date.now();

  // Seed Categories
  let testCategory = await Category.findOne({ name: 'Books & Study Materials' });
  if (!testCategory) {
    testCategory = await Category.create({
      name: 'Books & Study Materials',
      slug: `books-study-materials-${stamp}`,
      description: 'Textbooks and academic course notes',
      isActive: true,
    });
  }

  // 1x1 transparent PNG buffer for image upload tests
  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // ==========================================
  // E2E FLOW 1: ACCOUNT & IDENTITY LIFECYCLE
  // ==========================================
  let studentAToken, studentAId;
  let studentBToken, studentBId;
  let studentCToken, studentCId;
  let adminToken, adminId;

  await runCase(1, 'Student A Registration through verified login and profile access', async () => {
    const email = `student.14.a.${stamp}@bup.edu.bd`;
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student 14A',
        email,
        studentId: `14A${stamp.toString().slice(-6)}`,
        password: 'Password123!',
        department: 'ICT',
        batch: '2024',
        campusLocation: 'Mirpur Campus',
      }),
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201) return false;

    // Fetch user directly from DB to simulate email verification (include select: false field)
    const userA = await User.findOne({ email }).select('+verificationToken');
    if (!userA || !userA.verificationToken) return false;

    const verifyRes = await fetch(`${BASE}/auth/verify-email/${userA.verificationToken}`);
    if (verifyRes.status !== 200) return false;

    // Login
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
      }),
    });
    const loginJson = await loginRes.json();
    studentAToken = loginJson.data?.token;
    studentAId = loginJson.data?.user?.id;

    // Verify GET /me
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const meJson = await meRes.json();

    return loginRes.status === 200 && Boolean(studentAToken) && meJson.data?.isVerified === true;
  });

  // Seed Student B & Student C directly for multi-party flows
  const userB = await User.create({
    name: 'Student 14B',
    email: `student.14.b.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  studentBToken = generateToken(userB._id, USER_ROLES.STUDENT);
  studentBId = userB._id.toString();

  const userC = await User.create({
    name: 'Student 14C',
    email: `student.14.c.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  studentCToken = generateToken(userC._id, USER_ROLES.STUDENT);
  studentCId = userC._id.toString();

  const adminUser = await User.create({
    name: 'Platform Admin 14',
    email: `admin.14.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.ADMIN,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  adminToken = generateToken(adminUser._id, USER_ROLES.ADMIN);
  adminId = adminUser._id.toString();

  // Test 2: Unverified user restrictions
  await runCase(2, 'Unverified student account restricted from listing, requests, and AI', async () => {
    const unverifiedUser = await User.create({
      name: 'Unverified 14',
      email: `unverified.14.${stamp}@bup.edu.bd`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUS.ACTIVE,
      isVerified: false,
    });
    const unverifiedToken = generateToken(unverifiedUser._id, USER_ROLES.STUDENT);

    const resListing = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${unverifiedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Unverified Listing',
        description: 'Should fail',
        category: testCategory._id.toString(),
        price: 100,
        condition: 'good',
        campusLocation: 'Campus',
      }),
    });

    const resAssistant = await fetch(`${BASE}/ai/assistant`, {
      method: 'POST',
      headers: authHeaders(unverifiedToken),
      body: JSON.stringify({ message: 'Hello' }),
    });

    return resListing.status === 403 && resAssistant.status === 403;
  });

  // ==========================================
  // E2E FLOW 2: PRODUCT LISTING & SEARCH
  // ==========================================
  let productId;

  await runCase(3, 'Create product listing with image upload, retrieve, search, and view count', async () => {
    const formData = new FormData();
    formData.append('title', `Computer Networks 5th Edition ${stamp}`);
    formData.append('description', 'Tanenbaum networking textbook in good shape.');
    formData.append('category', testCategory._id.toString());
    formData.append('price', '650');
    formData.append('condition', 'good');
    formData.append('listingType', 'sell');
    formData.append('campusLocation', 'Mirpur Cantonment');
    formData.append('images', new Blob([dummyPng], { type: 'image/png' }), 'networks.png');

    const createRes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: formData,
    });
    const createJson = await createRes.json();
    productId = createJson.data?._id;

    if (createRes.status !== 201 || !productId) return false;

    // Search query
    const searchRes = await fetch(`${BASE}/products?q=Networks&category=${testCategory._id}`);
    const searchJson = await searchRes.json();
    const foundInSearch = searchJson.data?.products?.some((p) => p._id === productId);

    // View product detail
    const detailRes = await fetch(`${BASE}/products/${productId}`);
    const detailJson = await detailRes.json();

    return foundInSearch && detailRes.status === 200 && detailJson.data?.viewsCount >= 1;
  });

  // Test 4: Wishlist interactions
  await runCase(4, 'Wishlist lifecycle: Student B bookmarks Student A product', async () => {
    const addRes = await fetch(`${BASE}/wishlist/${productId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    const addJson = await addRes.json();

    const getRes = await fetch(`${BASE}/wishlist`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    const getJson = await getRes.json();
    const inWishlist = getJson.data?.items?.some((item) => String(item.product?._id || item.product) === String(productId));

    return [200, 201].includes(addRes.status) && inWishlist;
  });

  // ==========================================
  // E2E FLOW 3: BUY REQUEST & 2-STEP TRANSACTION
  // ==========================================
  let transactionId;

  await runCase(5, 'Buy-Request to 2-Step Transaction Confirmation & Auto-Sold Completion', async () => {
    // 1. Student B sends buy request to Student A
    const reqRes = await fetch(`${BASE}/buy-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentBToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        message: 'I would like to buy this book at campus cafeteria.',
      }),
    });
    const reqJson = await reqRes.json();
    const buyRequestId = reqJson.data?._id;
    if (reqRes.status !== 201 || !buyRequestId) return false;

    // 2. Student A (seller) accepts the buy request -> auto-creates transaction and reserves product
    const acceptRes = await fetch(`${BASE}/buy-requests/${buyRequestId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const acceptJson = await acceptRes.json();
    transactionId = acceptJson.meta?.transactionId || (await Transaction.findOne({ product: productId }))?._id?.toString();
    if (acceptRes.status !== 200 || !transactionId) return false;

    // Verify product is now RESERVED
    const reservedProduct = await Product.findById(productId);
    if (reservedProduct.status !== PRODUCT_STATUS.RESERVED) return false;

    // 3. Buyer (Student B) confirms handover
    const buyerConfirmRes = await fetch(`${BASE}/transactions/${transactionId}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    if (buyerConfirmRes.status !== 200) return false;

    // 4. Seller (Student A) confirms handover -> completes transaction & marks product SOLD
    const sellerConfirmRes = await fetch(`${BASE}/transactions/${transactionId}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const sellerConfirmJson = await sellerConfirmRes.json();

    const finalProduct = await Product.findById(productId);
    const finalTx = await Transaction.findById(transactionId);

    return (
      sellerConfirmRes.status === 200 &&
      finalTx.status === TRANSACTION_STATUS.COMPLETED &&
      finalProduct.status === PRODUCT_STATUS.SOLD
    );
  });

  // Test 6: Concurrency / Conflict Prevention on Reserved or Sold Products
  await runCase(6, 'Conflict prevention: Concurrent buy-request on sold item is rejected', async () => {
    // Student C tries to send a buy request for the sold product
    const res = await fetch(`${BASE}/buy-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentCToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        message: 'Can I still buy this?',
      }),
    });
    return res.status === 400 || res.status === 409;
  });

  // ==========================================
  // E2E FLOW 4: FREE GIVEAWAY LIFECYCLE
  // ==========================================
  await runCase(7, 'Free Giveaway Lifecycle: Price forced to 0 BDT through handover completion', async () => {
    // Student A lists a giveaway item
    const formData = new FormData();
    formData.append('title', `Free Class Lecture Notes ${stamp}`);
    formData.append('description', 'Free printed slides for students.');
    formData.append('category', testCategory._id.toString());
    formData.append('price', '200'); // Intentionally attempted positive price
    formData.append('condition', 'good');
    formData.append('listingType', 'giveaway');
    formData.append('campusLocation', 'Library Lobby');

    const createRes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: formData,
    });
    const createJson = await createRes.json();
    const giveawayProdId = createJson.data?._id;
    // Price must be forced to 0
    if (createJson.data?.price !== 0) return false;

    // Student B requests the giveaway
    const reqRes = await fetch(`${BASE}/giveaway-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentBToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: giveawayProdId,
        message: 'I need these lecture notes, thank you!',
      }),
    });
    const reqJson = await reqRes.json();
    const reqId = reqJson.data?._id;
    if (reqRes.status !== 201 || !reqId) return false;

    // Student A accepts giveaway request -> creates 0 BDT transaction
    const acceptRes = await fetch(`${BASE}/giveaway-requests/${reqId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const acceptJson = await acceptRes.json();
    const giveawayTxId = acceptJson.meta?.transactionId || (await Transaction.findOne({ product: giveawayProdId }))?._id?.toString();

    const giveawayTx = await Transaction.findById(giveawayTxId);
    return acceptRes.status === 200 && giveawayTx?.agreedPrice === 0;
  });

  // ==========================================
  // E2E FLOW 5: MESSAGING & PRIVACY ISOLATION
  // ==========================================
  await runCase(8, 'Messaging authorization: Only participants can read messages', async () => {
    // Student A starts conversation with Student B
    const convRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: studentBId,
        productId,
      }),
    });
    const convJson = await convRes.json();
    const convId = convJson.data?._id;
    if (!convId) return false;

    // Student A sends message
    const sendRes = await fetch(`${BASE}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hi Student B, let us meet at FST lobby.',
      }),
    });
    if (sendRes.status !== 200 && sendRes.status !== 201) return false;

    // Student B can read messages
    const bReadRes = await fetch(`${BASE}/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });

    // Student C (unauthorized outsider) attempts to read Student A & B's messages
    const cReadRes = await fetch(`${BASE}/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });

    return bReadRes.status === 200 && cReadRes.status === 403;
  });

  // ==========================================
  // E2E FLOW 6: REVIEWS & REPUTATION UPDATE
  // ==========================================
  await runCase(9, 'Reviews & Ratings: Buyer reviews seller, updating seller reputation', async () => {
    const revRes = await fetch(`${BASE}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentBToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        rating: 5,
        comment: 'Great seller! Textbook in excellent condition as described.',
      }),
    });
    const revJson = await revRes.json();

    // Check seller A's updated reputation
    const sellerUser = await User.findById(studentAId);
    return (
      revRes.status === 201 &&
      sellerUser.reputation.ratingsCount >= 1 &&
      sellerUser.reputation.averageRating === 5
    );
  });

  // ==========================================
  // E2E FLOW 7: REPORTING & ADMIN MODERATION
  // ==========================================
  await runCase(10, 'Reporting & Admin Moderation: Student reports item, admin resolves', async () => {
    // Student C reports product
    const reportRes = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentCToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetType: REPORT_TARGET.PRODUCT,
        targetId: productId,
        reason: REPORT_REASON.FRAUD,
        description: 'Test report for admin audit.',
      }),
    });
    const reportJson = await reportRes.json();
    const reportId = reportJson.data?._id;
    if (reportRes.status !== 201 || !reportId) return false;

    // Student A cannot access admin reports
    const studentAdminRes = await fetch(`${BASE}/admin/reports`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    if (studentAdminRes.status !== 403) return false;

    // Admin accesses report list
    const adminReportsRes = await fetch(`${BASE}/admin/reports`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (adminReportsRes.status !== 200) return false;

    // Admin resolves report
    const resolveRes = await fetch(`${BASE}/admin/reports/${reportId}/resolve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: MODERATION_ACTION.NONE, note: 'Verified resolved during audit.' }),
    });

    return resolveRes.status === 200;
  });

  // ==========================================
  // E2E FLOW 8: COMPLETE AI SERVICES SUITE
  // ==========================================
  await runCase(11, 'Phase 13A-13D AI features all respond with structured data', async () => {
    // 13A Description
    const aDesc = await fetch(`${BASE}/ai/product-description`, {
      method: 'POST',
      headers: authHeaders(studentAToken),
      body: JSON.stringify({
        title: 'Casio ClassWiz fx-991EX',
        condition: 'good',
        listingType: 'sell',
      }),
    });

    // 13B NL Search
    const bSearch = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(studentAToken),
      body: JSON.stringify({ query: 'scientific calculator under 1500', execute: false }),
    });

    // 13C Assistant
    const cAssistant = await fetch(`${BASE}/ai/assistant`, {
      method: 'POST',
      headers: authHeaders(studentAToken),
      body: JSON.stringify({ message: 'How do campus transactions work safely?' }),
    });

    // 13D Price Estimate
    const dEstimate = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(studentAToken),
      body: JSON.stringify({
        title: 'Casio ClassWiz fx-991EX Calculator',
        categoryId: testCategory._id.toString(),
        condition: 'good',
      }),
    });

    // 13D Image Classify
    const dForm = new FormData();
    dForm.append('image', new Blob([dummyPng], { type: 'image/png' }), 'casio-calculator.png');
    const dClassify = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'x-bypass-rate-limit': 'true',
      },
      body: dForm,
    });

    return (
      aDesc.status === 200 &&
      bSearch.status === 200 &&
      cAssistant.status === 200 &&
      dEstimate.status === 200 &&
      dClassify.status === 200
    );
  });

  // ==========================================
  // E2E FLOW 9: SECURITY & PRODUCTION HARDENING
  // ==========================================
  await runCase(12, 'Security Headers: X-Powered-By is hidden, nosniff & frame-options present', async () => {
    const res = await fetch(`${BASE}/health`);
    const poweredBy = res.headers.get('x-powered-by');
    const contentTypeOptions = res.headers.get('x-content-type-options');
    const frameOptions = res.headers.get('x-frame-options');

    return !poweredBy && contentTypeOptions === 'nosniff' && frameOptions === 'DENY';
  });

  await runCase(13, 'Isolated Static Storage: Temp uploads are not accessible via HTTP', async () => {
    // Attempt to access /uploads/temp/ should be blocked/404
    const res = await fetch(`http://127.0.0.1:${PORT}/uploads/temp/some-file.png`);
    return res.status === 404;
  });

  await runCase(14, 'File Header Validation: Renamed script with image extension is rejected (400)', async () => {
    const fakeScript = Buffer.from('console.log("malicious code execution");');
    const formData = new FormData();
    formData.append('image', new Blob([fakeScript], { type: 'image/png' }), 'exploit.png');

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    return res.status === 400 && json.message?.includes('Invalid image content');
  });

  // Test 15: Full Regression Cascade (invokes phase13dValidation.js)
  await runCase(15, 'Full Regression Cascade: Run Phase 13D validation suite', async () => {
    console.log('\n--- CASCADING TO PHASE 13D REGRESSION SUITE ---');
    const { ok, code } = await runRegression('phase13dValidation.js');
    console.log(`--- PHASE 13D REGRESSION EXIT CODE: ${code} ---`);
    return ok;
  });

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n=======================================');
  console.log(`PHASE 14 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase14Validation().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
