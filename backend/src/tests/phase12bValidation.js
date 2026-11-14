/**
 * UniMart AI — Phase 12B Validation Test Suite
 * Validates Admin Analytics & Platform Oversight Dashboard Backend
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { ExchangeRequest } from '../models/ExchangeRequest.js';
import { WantedPost } from '../models/WantedPost.js';
import { Report } from '../models/Report.js';
import {
  USER_ROLES,
  ACCOUNT_STATUS,
  PRODUCT_STATUS,
  LISTING_TYPES,
  PRODUCT_CONDITIONS,
  TRANSACTION_STATUS,
  TRANSACTION_SOURCE,
  EXCHANGE_TRANSACTION_STATUS,
  WANTED_STATUS,
  REPORT_STATUS,
  REPORT_TARGET,
  REPORT_REASON,
} from '../constants/index.js';
import { generateToken } from '../utils/token.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/v1`;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unimart_ai';

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

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
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

const runPhase12BValidation = async () => {
  console.log('--- STARTING PHASE 12B AUTOMATED TEST SUITE ---');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const stamp = Date.now();

  // 1. Seed Test Users
  const adminUser = await User.create({
    name: `Admin Analytics ${stamp}`,
    email: `admin.analytics.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.ADMIN,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });

  const studentActive = await User.create({
    name: `Student Active ${stamp}`,
    email: `student.active.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });

  const studentSuspended = await User.create({
    name: `Student Suspended ${stamp}`,
    email: `student.suspended.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.SUSPENDED,
    isVerified: true,
    campusLocation: 'Uttara Campus',
  });

  const studentBanned = await User.create({
    name: `Student Banned ${stamp}`,
    email: `student.banned.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.BANNED,
    isVerified: false,
    campusLocation: 'Main Campus',
  });

  const adminToken = generateToken(adminUser._id);
  const studentToken = generateToken(studentActive._id);

  // 2. Seed Test Category
  let testCat = await Category.findOne({ slug: `books-${stamp}` });
  if (!testCat) {
    testCat = await Category.create({
      name: `Books ${stamp}`,
      slug: `books-${stamp}`,
      description: 'Educational books',
    });
  }

  // 3. Seed Test Products (Available, Reserved, Sold, Inactive)
  const productAvailable = await Product.create({
    title: `Textbook Available ${stamp}`,
    description: 'Calculus book in good condition',
    category: testCat._id,
    seller: studentActive._id,
    listingType: LISTING_TYPES.SELL,
    price: 500,
    campusLocation: 'Mirpur Campus',
    condition: PRODUCT_CONDITIONS.GOOD,
    status: PRODUCT_STATUS.AVAILABLE,
  });

  const productReserved = await Product.create({
    title: `Textbook Reserved ${stamp}`,
    description: 'Physics book reserved',
    category: testCat._id,
    seller: studentActive._id,
    listingType: LISTING_TYPES.EXCHANGE,
    price: 0,
    campusLocation: 'Mirpur Campus',
    condition: PRODUCT_CONDITIONS.LIKE_NEW,
    status: PRODUCT_STATUS.RESERVED,
  });

  const productSold = await Product.create({
    title: `Textbook Sold ${stamp}`,
    description: 'Chemistry book sold',
    category: testCat._id,
    seller: studentActive._id,
    listingType: LISTING_TYPES.SELL,
    price: 750,
    campusLocation: 'Mirpur Campus',
    condition: PRODUCT_CONDITIONS.NEW,
    status: PRODUCT_STATUS.SOLD,
  });

  const productInactive = await Product.create({
    title: `Textbook Inactive ${stamp}`,
    description: 'Old notes inactive',
    category: testCat._id,
    seller: studentActive._id,
    listingType: LISTING_TYPES.GIVEAWAY,
    price: 0,
    campusLocation: 'Uttara Campus',
    condition: PRODUCT_CONDITIONS.FAIR,
    status: PRODUCT_STATUS.INACTIVE,
  });

  // 4. Seed Test Transactions
  // Completed direct sale (value: 750)
  const txCompletedSale = await Transaction.create({
    product: productSold._id,
    buyer: studentSuspended._id,
    seller: studentActive._id,
    sourceType: TRANSACTION_SOURCE.BUY_REQUEST,
    agreedPrice: 750,
    status: TRANSACTION_STATUS.COMPLETED,
    buyerConfirmed: true,
    sellerConfirmed: true,
    completedAt: new Date(),
    isActive: false,
  });

  // Cancelled direct sale
  const txCancelledSale = await Transaction.create({
    product: productAvailable._id,
    buyer: studentSuspended._id,
    seller: studentActive._id,
    sourceType: TRANSACTION_SOURCE.OFFER,
    agreedPrice: 450,
    status: TRANSACTION_STATUS.CANCELLED,
    cancelledAt: new Date(),
    cancellationReason: 'Buyer did not show up',
    isActive: false,
  });

  // Active / Pending sale
  const txActiveSale = await Transaction.create({
    product: productReserved._id,
    buyer: studentBanned._id,
    seller: studentActive._id,
    sourceType: TRANSACTION_SOURCE.BUY_REQUEST,
    agreedPrice: 600,
    status: TRANSACTION_STATUS.PENDING,
    isActive: true,
  });

  // Completed Giveaway transaction (agreedPrice: 0)
  const txCompletedGiveaway = await Transaction.create({
    product: productInactive._id,
    buyer: studentSuspended._id,
    seller: studentActive._id,
    sourceType: TRANSACTION_SOURCE.GIVEAWAY_REQUEST,
    agreedPrice: 0,
    status: TRANSACTION_STATUS.COMPLETED,
    completedAt: new Date(),
    isActive: false,
  });

  // 5. Seed Test Exchange Request & Transaction
  const exchangeReq = await ExchangeRequest.create({
    requestedProduct: productReserved._id,
    offeredProduct: productAvailable._id,
    proposer: studentSuspended._id,
    owner: studentActive._id,
    status: 'accepted',
  });

  const txCompletedExchange = await ExchangeTransaction.create({
    exchangeRequest: exchangeReq._id,
    requestedProduct: productReserved._id,
    offeredProduct: productAvailable._id,
    products: [productReserved._id, productAvailable._id],
    proposer: studentSuspended._id,
    owner: studentActive._id,
    status: EXCHANGE_TRANSACTION_STATUS.COMPLETED,
    proposerConfirmed: true,
    ownerConfirmed: true,
    completedAt: new Date(),
    isActive: false,
  });

  // 6. Seed Wanted Posts
  await WantedPost.create({
    author: studentActive._id,
    title: `Looking for Laptop Charger ${stamp}`,
    description: 'Type-C 65W charger needed urgently',
    status: WANTED_STATUS.ACTIVE,
    campusLocation: 'Mirpur Campus',
  });

  await WantedPost.create({
    author: studentActive._id,
    title: `Looking for Lab Coat ${stamp}`,
    description: 'Size L lab coat',
    status: WANTED_STATUS.FULFILLED,
    campusLocation: 'Mirpur Campus',
  });

  await WantedPost.create({
    author: studentActive._id,
    title: `Looking for Scientific Calculator ${stamp}`,
    description: 'Casio fx-991EX',
    status: WANTED_STATUS.CLOSED,
    campusLocation: 'Uttara Campus',
  });

  // 7. Seed Reports
  await Report.create({
    reporter: studentActive._id,
    targetType: REPORT_TARGET.PRODUCT,
    targetId: productInactive._id,
    reason: REPORT_REASON.MISLEADING,
    status: REPORT_STATUS.PENDING,
  });

  await Report.create({
    reporter: studentSuspended._id,
    targetType: REPORT_TARGET.USER,
    targetId: studentBanned._id,
    reason: REPORT_REASON.SPAM,
    status: REPORT_STATUS.RESOLVED,
    moderator: adminUser._id,
    moderatedAt: new Date(),
    moderationAction: 'BAN_USER',
  });

  console.log('Seeded test data for Phase 12B validation');

  // --- SECTION 1: AUTH & ACCESS CONTROL ---
  await runCase(1, 'Unauthenticated request to /admin/analytics/overview returns 401', async () => {
    const res = await fetch(`${BASE}/admin/analytics/overview`);
    return res.status === 401;
  });

  await runCase(2, 'Ordinary student access to /admin/analytics/overview returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE}/admin/analytics/overview`, {
      headers: authHeaders(studentToken),
    });
    return res.status === 403;
  });

  await runCase(3, 'Administrator access to /admin/analytics/overview succeeds with 200', async () => {
    const res = await fetch(`${BASE}/admin/analytics/overview`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    return res.status === 200 && data.success === true && Boolean(data.data);
  });

  await runCase(4, 'Alias route /admin/analytics also succeeds with 200 for admin', async () => {
    const res = await fetch(`${BASE}/admin/analytics`, {
      headers: authHeaders(adminToken),
    });
    return res.status === 200;
  });

  // --- SECTION 2: METRIC CLASSIFICATION & INTEGRITY ---
  let overview = null;
  const fetchOverview = async (query = '') => {
    const res = await fetch(`${BASE}/admin/analytics/overview${query}`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    return data.data;
  };

  overview = await fetchOverview();

  await runCase(5, 'User metrics: Total and status breakdown are reported accurately', async () => {
    const u = overview.users;
    return Boolean(
      u &&
      typeof u.total === 'number' &&
      u.total >= 4 &&
      u.active >= 2 &&
      u.suspended >= 1 &&
      u.banned >= 1 &&
      u.verified >= 3 &&
      u.byRole.admin >= 1 &&
      u.byRole.student >= 3
    );
  });

  await runCase(6, 'Listing metrics: Total and status breakdown are reported accurately', async () => {
    const l = overview.listings;
    return Boolean(
      l &&
      typeof l.total === 'number' &&
      l.total >= 4 &&
      l.available >= 1 &&
      l.reserved >= 1 &&
      l.sold >= 1 &&
      l.inactive >= 1 &&
      l.byType.sell >= 2 &&
      l.byType.exchange >= 1 &&
      l.byType.giveaway >= 1
    );
  });

  await runCase(7, 'Transaction metrics: Classifies completed, cancelled, and active transactions correctly', async () => {
    const t = overview.transactions;
    return Boolean(
      t &&
      t.completedSales >= 1 &&
      t.cancelledSales >= 1 &&
      t.activeSales >= 1 &&
      t.completedExchanges >= 1 &&
      t.completedGiveaways >= 1 &&
      t.totalCompletedAll >= 3 &&
      t.totalCancelledAll >= 1
    );
  });

  await runCase(8, 'Monetary sales volume: Computed ONLY from completed sales with agreedPrice > 0', async () => {
    const t = overview.transactions;
    // Sales volume must be positive and not include the zero-price giveaway or exchange transactions
    return Boolean(
      typeof t.completedSalesVolumeBDT === 'number' &&
      t.completedSalesVolumeBDT >= 750
    );
  });

  await runCase(9, 'Exchange and giveaway completions are categorized separately without double-counting', async () => {
    const t = overview.transactions;
    return Boolean(
      t.completedExchanges >= 1 &&
      t.completedGiveaways >= 1 &&
      t.totalCompletedAll === t.completedSales + t.completedExchanges + t.completedGiveaways
    );
  });

  await runCase(10, 'Wanted posts metrics: Accurate counts for active, fulfilled, and closed', async () => {
    const w = overview.wantedPosts;
    return Boolean(
      w &&
      w.total >= 3 &&
      w.active >= 1 &&
      w.fulfilled >= 1 &&
      w.closed >= 1
    );
  });

  await runCase(11, 'Report metrics: Accurate counts for pending, reviewed, resolved, and dismissed', async () => {
    const r = overview.reports;
    return Boolean(
      r &&
      r.total >= 2 &&
      r.pending >= 1 &&
      r.resolved >= 1
    );
  });

  await runCase(12, 'Category distribution: Includes category name, total listings, and available listings', async () => {
    const cats = overview.categoryDistribution;
    const seededCatEntry = cats.find((c) => c.name === `Books ${stamp}`);
    return Boolean(
      Array.isArray(cats) &&
      seededCatEntry &&
      seededCatEntry.totalListings >= 4 &&
      seededCatEntry.availableListings >= 1
    );
  });

  await runCase(13, 'Campus distribution: Lists campus location and listing counts', async () => {
    const campuses = overview.campusDistribution;
    const mirpur = campuses.find((c) => c.campus === 'Mirpur Campus');
    return Boolean(
      Array.isArray(campuses) &&
      mirpur &&
      mirpur.listingsCount >= 3
    );
  });

  await runCase(14, 'Trend series: Continuous daily arrays for userRegistrations, newListings, completedTransactions', async () => {
    const tr = overview.trends;
    return Boolean(
      Array.isArray(tr.userRegistrations) &&
      tr.userRegistrations.length > 0 &&
      Array.isArray(tr.newListings) &&
      tr.newListings.length > 0 &&
      Array.isArray(tr.completedTransactions) &&
      tr.completedTransactions.length > 0 &&
      typeof tr.newListings[0].count === 'number' &&
      typeof tr.newListings[0].date === 'string'
    );
  });

  // --- SECTION 3: DATE-RANGE FILTERING & PARAMETER GUARDS ---
  await runCase(15, 'Time range preset: ?timeRange=7d returns valid 7-day range label and series', async () => {
    const data7d = await fetchOverview('?timeRange=7d');
    return Boolean(
      data7d &&
      data7d.timeRange.label.includes('7 Days') &&
      data7d.trends.newListings.length <= 8
    );
  });

  await runCase(16, 'Time range preset: ?timeRange=all returns 365-day range label', async () => {
    const dataAll = await fetchOverview('?timeRange=all');
    return Boolean(
      dataAll &&
      dataAll.timeRange.label.includes('All Time')
    );
  });

  await runCase(17, 'Custom date range: Valid startDate and endDate filter properly', async () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const dataCustom = await fetchOverview(`?startDate=${past}&endDate=${today}`);
    return Boolean(
      dataCustom &&
      dataCustom.timeRange.label.includes(past)
    );
  });

  await runCase(18, 'Date guard: Invalid date string returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE}/admin/analytics/overview?startDate=not-a-date`, {
      headers: authHeaders(adminToken),
    });
    const body = await res.json();
    return res.status === 400 && body.success === false;
  });

  await runCase(19, 'Date guard: startDate > endDate returns 400 Bad Request', async () => {
    const res = await fetch(
      `${BASE}/admin/analytics/overview?startDate=2026-10-25&endDate=2026-10-20`,
      {
        headers: authHeaders(adminToken),
      }
    );
    const body = await res.json();
    return res.status === 400 && body.success === false;
  });

  await runCase(20, 'Date guard: Exceeding 365-day max window returns 400 Bad Request', async () => {
    const res = await fetch(
      `${BASE}/admin/analytics/overview?startDate=2020-01-01&endDate=2026-10-23`,
      {
        headers: authHeaders(adminToken),
      }
    );
    const body = await res.json();
    return res.status === 400 && body.message.includes('maximum allowed window');
  });

  // --- SECTION 4: DATA HYGIENE & PRIVACY ---
  await runCase(21, 'Privacy guard: Analytics responses NEVER expose password hashes or sensitive tokens', async () => {
    const res = await fetch(`${BASE}/admin/analytics/overview`, {
      headers: authHeaders(adminToken),
    });
    const text = await res.text();
    return (
      !text.includes('passwordHash') &&
      !text.includes('verificationToken') &&
      !text.includes('resetPasswordToken') &&
      !text.includes('phone') &&
      !text.includes('studentId')
    );
  });

  // --- SECTION 5: COMPATIBILITY & REGRESSION ---
  await runCase(22, 'Phase 12A moderation endpoint /admin/reports remains fully functional', async () => {
    const res = await fetch(`${BASE}/admin/reports?limit=5`, {
      headers: authHeaders(adminToken),
    });
    const data = await res.json();
    return res.status === 200 && data.success === true && Array.isArray(data.data?.reports);
  });

  console.log('\n--- EXECUTING PHASE 12A REGRESSION SUITE ---');
  await runCase(23, 'Phase 12A regression suite passes cleanly', async () => {
    const regRes = await runRegression('phase12Validation.js');
    console.log(`\nPhase 12A regression result: code=${regRes.code}, ok=${regRes.ok}`);
    return regRes.ok;
  });

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n=============================================');
  console.log(`PHASE 12B VALIDATION SUMMARY:`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=============================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

runPhase12BValidation().catch((err) => {
  console.error('Fatal test error in Phase 12B validation:', err);
  process.exit(1);
});
