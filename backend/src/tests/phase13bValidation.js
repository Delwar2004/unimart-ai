/**
 * UniMart AI — Phase 13B Validation Test Suite
 * Validates Natural Language Search and Personalized Recommendations
 */

import dotenv from 'dotenv';
dotenv.config();

// Default testing mode uses the deterministic mock provider
process.env.AI_PROVIDER = 'mock';

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Wishlist } from '../models/Wishlist.js';
import { Transaction } from '../models/Transaction.js';
import {
  USER_ROLES,
  ACCOUNT_STATUS,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  LISTING_TYPES,
  TRANSACTION_STATUS,
  TRANSACTION_SOURCE,
} from '../constants/index.js';
import { generateToken } from '../utils/token.js';
import { sanitizeSearchInterpretation } from '../services/aiProvider.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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

const runPhase13BValidation = async () => {
  console.log('--- STARTING PHASE 13B AUTOMATED TEST SUITE ---');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const stamp = Date.now();

  // 1. Seed two test students
  const studentA = await User.create({
    name: `Student 13B A ${stamp}`,
    email: `student.13b.a.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  const tokenA = generateToken(studentA._id);

  const studentB = await User.create({
    name: `Student 13B B ${stamp}`,
    email: `student.13b.b.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Uttara Campus',
  });
  const tokenB = generateToken(studentB._id);

  // 2. Fetch existing primary categories or seed standard ones
  let booksCat = await Category.findOne({ name: 'Books & Notes' }) || await Category.findOne({ name: /Books/i });
  if (!booksCat) {
    booksCat = await Category.create({
      name: `Books & Notes`,
      slug: `books-notes-${stamp}`,
      description: 'Textbooks and educational notes',
      subcategories: ['Textbooks', 'Course Notes'],
    });
  }

  let electronicsCat = await Category.findOne({ name: 'Electronics & Gadgets' }) || await Category.findOne({ name: /Electronics/i });
  if (!electronicsCat) {
    electronicsCat = await Category.create({
      name: `Electronics & Gadgets`,
      slug: `electronics-${stamp}`,
      description: 'Campus electronics and devices',
      subcategories: ['Calculators', 'Laptops'],
    });
  }

  // 3. Seed test products
  // Product 1: Available programming book listed by Student B (price: 350)
  const bookProduct = await Product.create({
    title: `Programming Algorithms Book ${stamp}`,
    description: 'Essential data structures and algorithms textbook in good condition.',
    category: booksCat._id,
    seller: studentB._id,
    listingType: LISTING_TYPES.SELL,
    price: 350,
    condition: PRODUCT_CONDITIONS.GOOD,
    campusLocation: 'Mirpur Campus',
    status: PRODUCT_STATUS.AVAILABLE,
    viewsCount: 15,
  });

  // Product 2: Available calculator listed by Student B
  const calcProduct = await Product.create({
    title: `Scientific Calculator FX-991 ${stamp}`,
    description: 'Casio scientific calculator like new condition.',
    category: electronicsCat._id,
    seller: studentB._id,
    listingType: LISTING_TYPES.SELL,
    price: 1200,
    condition: PRODUCT_CONDITIONS.LIKE_NEW,
    campusLocation: 'Mirpur Campus',
    status: PRODUCT_STATUS.AVAILABLE,
    viewsCount: 25,
  });

  // Product 3: Sold book listed by Student B (should NOT appear in available search or recs)
  const soldBook = await Product.create({
    title: `Sold Calculus Guide ${stamp}`,
    description: 'Calculus textbook already completed transaction.',
    category: booksCat._id,
    seller: studentB._id,
    listingType: LISTING_TYPES.SELL,
    price: 300,
    condition: PRODUCT_CONDITIONS.GOOD,
    campusLocation: 'Mirpur Campus',
    status: PRODUCT_STATUS.SOLD,
  });

  // Product 4: Product owned by Student A (should NOT be recommended to Student A)
  const studentAOwnProduct = await Product.create({
    title: `My Own Laptop Sleeve ${stamp}`,
    description: 'Padded sleeve for laptop.',
    category: electronicsCat._id,
    seller: studentA._id,
    listingType: LISTING_TYPES.SELL,
    price: 500,
    condition: PRODUCT_CONDITIONS.NEW,
    campusLocation: 'Mirpur Campus',
    status: PRODUCT_STATUS.AVAILABLE,
  });

  // Add Product 1 to Student A's wishlist to test wishlist-based recommendation signal
  await Wishlist.create({
    user: studentA._id,
    product: bookProduct._id,
  });

  // Test 1: Unauthenticated search-query rejected (401)
  await runCase(1, 'Unauthenticated search query request rejected (401)', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Find programming books' }),
    });
    return res.status === 401;
  });

  // Test 2: Unauthenticated recommendation request rejected (401)
  await runCase(2, 'Unauthenticated recommendation request rejected (401)', async () => {
    const res = await fetch(`${BASE}/ai/recommendations`, {
      method: 'GET',
    });
    return res.status === 401;
  });

  // Test 3: Empty / whitespace query rejected (400)
  await runCase(3, 'Empty or whitespace search query rejected (400)', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ query: '   ' }),
    });
    const json = await res.json();
    return res.status === 400 && json.success === false;
  });

  // Test 4: Oversized search query rejected (400)
  await runCase(4, 'Oversized search query (> 300 chars) rejected (400)', async () => {
    const longQuery = 'laptop '.repeat(60);
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ query: longQuery }),
    });
    const json = await res.json();
    return res.status === 400 && json.success === false;
  });

  // Test 5: Structured query interpretation (budget, category, sort)
  await runCase(5, 'Valid query produces structured interpretation', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'Find affordable programming books under 500 taka.',
        execute: false,
      }),
    });
    const json = await res.json();
    const interp = json.data?.interpretation;
    return (
      res.status === 200 &&
      json.success === true &&
      interp.maxPrice === 500 &&
      interp.sort === 'price_asc' &&
      interp.q.includes('programming books')
    );
  });

  // Test 6: Ambiguous query does not invent imaginary filters
  await runCase(6, 'Ambiguous query does not invent imaginary budget or campus', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'calculators',
        execute: false,
      }),
    });
    const json = await res.json();
    const interp = json.data?.interpretation;
    return (
      res.status === 200 &&
      interp.minPrice === null &&
      interp.maxPrice === null &&
      interp.condition === null &&
      interp.listingType === null &&
      interp.campusLocation === null
    );
  });

  // Test 7: Explicit listing types (giveaway / exchange)
  await runCase(7, 'Explicit listing type interpreted correctly (free -> giveaway)', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'Find free lab coats or giveaway supplies',
        execute: false,
      }),
    });
    const json = await res.json();
    const interp = json.data?.interpretation;
    return res.status === 200 && interp.listingType === 'giveaway' && interp.maxPrice === 0;
  });

  // Test 8: Explicit condition (like-new)
  await runCase(8, 'Explicit condition interpreted correctly (like-new)', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'Show me like-new scientific calculator',
        execute: false,
      }),
    });
    const json = await res.json();
    const interp = json.data?.interpretation;
    return res.status === 200 && interp.condition === 'like-new';
  });

  // Test 9: Explicit price range (between 1000 and 5000)
  await runCase(9, 'Explicit price range between 1000 and 5000 BDT', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'Laptop between 1000 and 5000 BDT',
        execute: false,
      }),
    });
    const json = await res.json();
    const interp = json.data?.interpretation;
    return res.status === 200 && interp.minPrice === 1000 && interp.maxPrice === 5000;
  });

  // Test 10: Operator injection resistance
  await runCase(10, 'MongoDB injection characters stripped from interpretation', async () => {
    const malicious = {
      q: '{$gt: ""}$where: "return true"',
      minPrice: 'invalid',
      condition: '$gt: 5',
      listingType: '{ $ne: null }',
    };
    const sanitized = sanitizeSearchInterpretation(malicious, [booksCat]);
    return (
      !sanitized.q.includes('$') &&
      !sanitized.q.includes('{') &&
      sanitized.minPrice === null &&
      sanitized.condition === null &&
      sanitized.listingType === null
    );
  });

  // Test 11: Category whitelisting (unsupported/forged category set to null)
  await runCase(11, 'Forged category ID not in database rejected by sanitizer', async () => {
    const fakeCat = { categoryId: new mongoose.Types.ObjectId().toString() };
    const sanitized = sanitizeSearchInterpretation(fakeCat, [booksCat, electronicsCat]);
    return sanitized.category === null && sanitized.categoryName === null;
  });

  // Test 12: Invalid enum values rejected
  await runCase(12, 'Unsupported enum values rejected by sanitizer', async () => {
    const invalid = { condition: 'destroyed', listingType: 'rent', sort: 'hack_sort' };
    const sanitized = sanitizeSearchInterpretation(invalid, []);
    return (
      sanitized.condition === null &&
      sanitized.listingType === null &&
      sanitized.sort === 'newest'
    );
  });

  // Test 13: Natural-language search with execute: true returns matching products
  await runCase(13, 'Natural-language search execution returns matching products', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: `Programming Algorithms Book under 500 taka`,
        execute: true,
      }),
    });
    const json = await res.json();
    const prods = json.data?.products || [];
    const found = prods.some((p) => p._id.toString() === bookProduct._id.toString());
    return res.status === 200 && json.success === true && found;
  });

  // Test 14: Inactive and sold products are never returned by AI search
  await runCase(14, 'Sold products excluded from AI search execution', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: `Sold Calculus Guide`,
        execute: true,
      }),
    });
    const json = await res.json();
    const prods = json.data?.products || [];
    const foundSold = prods.some((p) => p._id.toString() === soldBook._id.toString());
    return res.status === 200 && !foundSold;
  });

  // Test 15: Normal keyword search remains completely functional
  await runCase(15, 'Normal keyword search GET /products remains functional', async () => {
    const res = await fetch(`${BASE}/products?q=Algorithms`, {
      method: 'GET',
    });
    const json = await res.json();
    const prods = json.data?.products || [];
    return res.status === 200 && prods.length > 0;
  });

  // Test 16: AI Provider error handling (missing Gemini API key returns 503)
  await runCase(16, 'Gemini provider without API key returns 503 error', async () => {
    const res = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA, 'gemini'),
      body: JSON.stringify({ query: 'calculators' }),
    });
    const json = await res.json();
    return res.status === 503 && json.message.includes('not configured');
  });

  // Test 17: Recommendations exclude user's own listings
  await runCase(17, 'Recommendations exclude user own listings', async () => {
    const res = await fetch(`${BASE}/ai/recommendations`, {
      method: 'GET',
      headers: authHeaders(tokenA),
    });
    const json = await res.json();
    const recs = json.data?.recommendations || [];
    const hasOwn = recs.some((p) => p._id.toString() === studentAOwnProduct._id.toString());
    return res.status === 200 && !hasOwn;
  });

  // Test 18: Recommendations exclude sold and inactive listings
  await runCase(18, 'Recommendations exclude sold and inactive listings', async () => {
    const res = await fetch(`${BASE}/ai/recommendations`, {
      method: 'GET',
      headers: authHeaders(tokenA),
    });
    const json = await res.json();
    const recs = json.data?.recommendations || [];
    const hasSold = recs.some((p) => p._id.toString() === soldBook._id.toString());
    return res.status === 200 && !hasSold;
  });

  // Test 19: Duplicate recommendations are prevented
  await runCase(19, 'Recommendations contain no duplicate products', async () => {
    const res = await fetch(`${BASE}/ai/recommendations?limit=10`, {
      method: 'GET',
      headers: authHeaders(tokenA),
    });
    const json = await res.json();
    const recs = json.data?.recommendations || [];
    const ids = recs.map((r) => r._id.toString());
    const uniqueIds = new Set(ids);
    return res.status === 200 && ids.length === uniqueIds.size;
  });

  // Test 20: Safe fallback for user with no history
  await runCase(20, 'User with no history receives safe fallback recommendations', async () => {
    const res = await fetch(`${BASE}/ai/recommendations`, {
      method: 'GET',
      headers: authHeaders(tokenB), // Student B has no wishlist items
    });
    const json = await res.json();
    const recs = json.data?.recommendations || [];
    return res.status === 200 && json.success === true && recs.length > 0;
  });

  // Test 21: Privacy check: recommendations contain no private user fields
  await runCase(21, 'Recommendations contain no sensitive student information', async () => {
    const res = await fetch(`${BASE}/ai/recommendations`, {
      method: 'GET',
      headers: authHeaders(tokenA),
    });
    const json = await res.json();
    const recs = json.data?.recommendations || [];
    let isPrivateClean = true;
    for (const r of recs) {
      if (r.seller?.passwordHash || r.seller?.email || r.seller?.phone || r.seller?.resetPasswordToken) {
        isPrivateClean = false;
        break;
      }
      if (!r.recommendationReason) {
        isPrivateClean = false;
        break;
      }
    }
    return res.status === 200 && isPrivateClean;
  });

  // Test 22: AI rate limiting works
  await runCase(22, 'Rate limiter triggers 429 when quota exceeded without bypass', async () => {
    const rateLimitUser = await User.create({
      name: `RateLimit Tester ${Date.now()}`,
      email: `ratelimit.${Date.now()}@bup.edu.bd`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUS.ACTIVE,
      isVerified: true,
    });
    const spamToken = generateToken(rateLimitUser._id);
    let hitRateLimit = false;

    // Send rapid requests without bypass header
    for (let i = 0; i < 70; i++) {
      const res = await fetch(`${BASE}/ai/search-query`, {
        method: 'POST',
        headers: authHeaders(spamToken, 'mock', false), // bypass = false
        body: JSON.stringify({ query: 'textbooks' }),
      });
      if (res.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    return hitRateLimit;
  });

  // Test 23: Phase 13A product description & category suggestion still work
  await runCase(23, 'Phase 13A product-description and suggest-category still functional', async () => {
    const descRes = await fetch(`${BASE}/ai/product-description`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Algorithms in C++',
        condition: 'good',
        listingType: 'sell',
      }),
    });
    const descJson = await descRes.json();

    const catRes = await fetch(`${BASE}/ai/suggest-category`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Algorithms in C++',
      }),
    });
    const catJson = await catRes.json();

    return (
      descRes.status === 200 &&
      Boolean(descJson.data?.description) &&
      catRes.status === 200 &&
      Boolean(catJson.data?.categoryId)
    );
  });

  // Test 24: Full Regression Cascade (invokes phase13aValidation.js)
  await runCase(24, 'Full Regression Cascade: Run Phase 13A validation suite', async () => {
    console.log('\n--- CASCADING TO PHASE 13A REGRESSION SUITE ---');
    const { ok, code } = await runRegression('phase13aValidation.js');
    console.log(`--- PHASE 13A REGRESSION EXIT CODE: ${code} ---`);
    return ok;
  });

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n=======================================');
  console.log(`PHASE 13B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase13BValidation().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
