/**
 * UniMart AI — Phase 13D Validation Test Suite
 * Validates AI-assisted price estimation and product image classification,
 * security boundaries, historical comparables vs fallback, upload cleanup, and full regression.
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

const runPhase13DValidation = async () => {
  console.log('--- STARTING PHASE 13D AUTOMATED TEST SUITE ---');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const stamp = Date.now();

  // 1. Seed verified student A (primary seller/user)
  const studentA = await User.create({
    name: `Student 13D Verified A ${stamp}`,
    email: `student.13d.a.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  const tokenA = generateToken(studentA._id);

  // 2. Seed verified student B (other campus peer for comparables)
  const studentB = await User.create({
    name: `Student 13D Verified B ${stamp}`,
    email: `student.13d.b.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: true,
    campusLocation: 'Mirpur Campus',
  });
  const tokenB = generateToken(studentB._id);

  // 3. Seed unverified student
  const studentUnverified = await User.create({
    name: `Student 13D Unverified ${stamp}`,
    email: `unverified.13d.${stamp}@bup.edu.bd`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
    isVerified: false,
    campusLocation: 'Mirpur Campus',
  });
  const tokenUnverified = generateToken(studentUnverified._id);

  // 4. Seed categories
  let booksCat = await Category.findOne({ name: 'Books & Study Materials' });
  if (!booksCat) {
    booksCat = await Category.findOne({ slug: 'books-study-materials' });
  }
  if (!booksCat) {
    booksCat = await Category.create({
      name: 'Books & Study Materials',
      slug: `books-study-materials-${stamp}`,
      description: 'Textbooks and academic course notes',
      isActive: true,
    });
  }

  let electronicsCat = await Category.findOne({ name: 'Electronics & Gadgets' });
  if (!electronicsCat) {
    electronicsCat = await Category.findOne({ slug: 'electronics-gadgets' });
  }
  if (!electronicsCat) {
    electronicsCat = await Category.create({
      name: 'Electronics & Gadgets',
      slug: `electronics-gadgets-${stamp}`,
      description: 'Scientific calculators, laptops, and student gadgets',
      isActive: true,
    });
  }

  // 5. Seed historical comparables for Student B (different seller)
  // Product 1 by Student B (Calculus textbook, sold, price 500 BDT)
  const p1 = await Product.create({
    title: 'Engineering Calculus 8th Edition',
    description: 'James Stewart calculus textbook in good condition.',
    category: booksCat._id,
    seller: studentB._id,
    listingType: LISTING_TYPES.SELL,
    price: 500,
    condition: PRODUCT_CONDITIONS.GOOD,
    status: PRODUCT_STATUS.SOLD,
    campusLocation: 'Mirpur Campus',
  });

  // Product 2 by Student B (Calculus textbook, available, price 550 BDT)
  const p2 = await Product.create({
    title: 'Engineering Calculus Early Transcendentals',
    description: 'Stewart calculus textbook, clean pages.',
    category: booksCat._id,
    seller: studentB._id,
    listingType: LISTING_TYPES.SELL,
    price: 550,
    condition: PRODUCT_CONDITIONS.GOOD,
    status: PRODUCT_STATUS.AVAILABLE,
    campusLocation: 'Mirpur Campus',
  });

  // Completed transaction for p1 between Student B and another student
  await Transaction.create({
    product: p1._id,
    buyer: studentA._id,
    seller: studentB._id,
    sourceType: TRANSACTION_SOURCE.BUY_REQUEST,
    agreedPrice: 500,
    status: TRANSACTION_STATUS.COMPLETED,
    buyerConfirmed: true,
    sellerConfirmed: true,
  });

  // Student A's own listing (with an extreme outlier price of 50,000 BDT) to test exclusion
  const ownProductA = await Product.create({
    title: 'Engineering Calculus My Own Listing',
    description: 'My own textbook listing.',
    category: booksCat._id,
    seller: studentA._id,
    listingType: LISTING_TYPES.SELL,
    price: 50000,
    condition: PRODUCT_CONDITIONS.GOOD,
    status: PRODUCT_STATUS.AVAILABLE,
    campusLocation: 'Mirpur Campus',
  });

  // 1x1 transparent PNG buffer for image upload tests
  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // ==========================================
  // FEATURE A: AI-ASSISTED PRICE ESTIMATION
  // ==========================================

  // Test 1: Unauthenticated price estimation rejected (401)
  await runCase(1, 'Unauthenticated price estimation request rejected with 401', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Engineering Mathematics',
        categoryId: booksCat._id.toString(),
        condition: 'good',
      }),
    });
    return res.status === 401;
  });

  // Test 2: Unverified student price estimation rejected (403)
  await runCase(2, 'Unverified student price estimation rejected with 403', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenUnverified),
      body: JSON.stringify({
        title: 'Engineering Mathematics',
        categoryId: booksCat._id.toString(),
        condition: 'good',
      }),
    });
    return res.status === 403;
  });

  // Test 3: Missing or short title rejected (400)
  await runCase(3, 'Short or empty title (< 3 chars) rejected with 400', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'ab',
        categoryId: booksCat._id.toString(),
        condition: 'good',
      }),
    });
    return res.status === 400;
  });

  // Test 4: Oversized title (> 200 chars) rejected (400)
  await runCase(4, 'Oversized title (> 200 chars) rejected with 400', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'A'.repeat(205),
        categoryId: booksCat._id.toString(),
        condition: 'good',
      }),
    });
    return res.status === 400;
  });

  // Test 5: Invalid category ID rejected (400)
  await runCase(5, 'Invalid category ID format rejected with 400', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Calculus Textbook',
        categoryId: 'not-an-objectid',
        condition: 'good',
      }),
    });
    return res.status === 400;
  });

  // Test 6: Nonexistent category ID rejected (400)
  await runCase(6, 'Nonexistent category ID rejected with 400', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Calculus Textbook',
        categoryId: fakeId,
        condition: 'good',
      }),
    });
    return res.status === 400;
  });

  // Test 7: Invalid condition enum rejected (400)
  await runCase(7, 'Invalid condition value rejected with 400', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Calculus Textbook',
        categoryId: booksCat._id.toString(),
        condition: 'destroyed_beyond_recognition',
      }),
    });
    return res.status === 400;
  });

  // Test 8: Invalid listingType rejected (400)
  await runCase(8, 'Invalid listingType rejected with 400', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Calculus Textbook',
        categoryId: booksCat._id.toString(),
        condition: 'good',
        listingType: 'auction',
      }),
    });
    return res.status === 400;
  });

  // Test 9: Giveaway pricing respects zero-price rule (0 BDT, giveaway_policy)
  await runCase(9, 'Giveaway pricing enforces 0 BDT with giveaway_policy method', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Calculus Textbook Giveaway',
        categoryId: booksCat._id.toString(),
        condition: 'good',
        listingType: 'giveaway',
      }),
    });
    const json = await res.json();
    return (
      res.status === 200 &&
      json.success === true &&
      json.data.suggestedPrice === 0 &&
      json.data.minimumSuggestedPrice === 0 &&
      json.data.maximumSuggestedPrice === 0 &&
      json.data.currency === 'BDT' &&
      json.data.estimationMethod === 'giveaway_policy'
    );
  });

  // Test 10: Reliable historical comparables used correctly
  await runCase(10, 'Reliable historical comparables used correctly when available', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Engineering Calculus Textbook',
        categoryId: booksCat._id.toString(),
        condition: 'good',
        listingType: 'sell',
      }),
    });
    const json = await res.json();
    const data = json.data;
    const isComparables = data?.estimationMethod === 'historical_comparables';
    const hasCount = data?.comparablesCount >= 2;
    const sensiblePrice = data?.suggestedPrice >= 450 && data?.suggestedPrice <= 600;
    return res.status === 200 && isComparables && hasCount && sensiblePrice;
  });

  // Test 11: Own listings excluded from comparables
  await runCase(11, 'Own listings excluded from price comparables calculation', async () => {
    // Student A's own listing price was 50,000 BDT
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Engineering Calculus Textbook',
        categoryId: booksCat._id.toString(),
        condition: 'good',
      }),
    });
    const json = await res.json();
    // Price should remain based on student B's listings (~500 BDT), NOT 50,000 BDT
    return res.status === 200 && json.data.suggestedPrice < 5000;
  });

  // Test 12: Insufficient historical data clearly identified as fallback
  await runCase(12, 'Insufficient historical data uses attribute fallback with low confidence', async () => {
    // Create an empty fresh category with 0 listings
    const rareCat = await Category.create({
      name: `Rare Antiques ${stamp}`,
      slug: `rare-antiques-${stamp}`,
      description: 'Items with no sales history',
      isActive: true,
    });

    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Vintage Department Brass Seal',
        categoryId: rareCat._id.toString(),
        condition: 'fair',
      }),
    });
    const json = await res.json();
    return (
      res.status === 200 &&
      json.data.estimationMethod === 'attribute_fallback' &&
      json.data.confidence === 'low' &&
      json.data.comparablesCount === 0
    );
  });

  // Test 13: Estimation never modifies saved database products
  await runCase(13, 'Price estimation never modifies saved products in database', async () => {
    const preListing = await Product.findById(ownProductA._id);
    const initialPrice = preListing.price;

    await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: ownProductA.title,
        categoryId: ownProductA.category.toString(),
        condition: ownProductA.condition,
      }),
    });

    const postListing = await Product.findById(ownProductA._id);
    return postListing.price === initialPrice;
  });

  // Test 14: Live provider without API key returns controlled 503
  await runCase(14, 'Live provider without API key returns controlled 503', async () => {
    const res = await fetch(`${BASE}/ai/estimate-price`, {
      method: 'POST',
      headers: authHeaders(tokenA, 'gemini'),
      body: JSON.stringify({
        title: 'Unique Custom Sensor Kit',
        categoryId: electronicsCat._id.toString(),
        condition: 'good',
      }),
    });
    const json = await res.json();
    return res.status === 503 && json.message?.includes('AI service is not configured');
  });

  // Test 15: Rate limiter triggers 429 when quota exceeded
  await runCase(15, 'Rate limiter triggers 429 when request quota exceeded without bypass', async () => {
    // Create isolated user for rate limit check
    const rateUser = await User.create({
      name: `Rate Limit Tester 13D ${stamp}`,
      email: `ratelimit.13d.${stamp}@bup.edu.bd`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUS.ACTIVE,
      isVerified: true,
      campusLocation: 'Mirpur Campus',
    });
    const rateToken = generateToken(rateUser._id);

    let hit429 = false;
    for (let i = 0; i < 70; i++) {
      const res = await fetch(`${BASE}/ai/estimate-price`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rateToken}`,
          'Content-Type': 'application/json',
          // No bypass header
        },
        body: JSON.stringify({
          title: 'Quick Rate Check',
          categoryId: booksCat._id.toString(),
          condition: 'good',
        }),
      });
      if (res.status === 429) {
        hit429 = true;
        break;
      }
    }
    return hit429;
  });

  // ==========================================
  // FEATURE B: AI PRODUCT IMAGE CLASSIFICATION
  // ==========================================

  // Test 16: Unauthenticated image classification rejected (401)
  await runCase(16, 'Unauthenticated image classification rejected with 401', async () => {
    const formData = new FormData();
    formData.append('image', new Blob([dummyPng], { type: 'image/png' }), 'test.png');

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      body: formData,
    });
    return res.status === 401;
  });

  // Test 17: Unverified student image classification rejected (403)
  await runCase(17, 'Unverified student image classification rejected with 403', async () => {
    const formData = new FormData();
    formData.append('image', new Blob([dummyPng], { type: 'image/png' }), 'test.png');

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUnverified}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    return res.status === 403;
  });

  // Test 18: Missing image file rejected (400)
  await runCase(18, 'Missing image file rejected with 400', async () => {
    const formData = new FormData();
    // No image appended

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    return res.status === 400;
  });

  // Test 19: Invalid file format (text/javascript) rejected (400)
  await runCase(19, 'Invalid file format rejected with 400', async () => {
    const formData = new FormData();
    const badScript = Buffer.from('console.log("malicious code");');
    formData.append('image', new Blob([badScript], { type: 'text/javascript' }), 'exploit.js');

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    return res.status === 400 && json.message?.includes('Invalid file format');
  });

  // Test 20: Valid supported image processed correctly by configured provider
  await runCase(20, 'Valid supported image classified with structured suggestion', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'casio-scientific-calculator-fx991ex.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    const d = json.data;
    return (
      res.status === 200 &&
      json.success === true &&
      typeof d.suggestedCategoryId === 'string' &&
      typeof d.suggestedCategoryName === 'string' &&
      typeof d.visibleProductType === 'string' &&
      Array.isArray(d.observableAttributes) &&
      d.observableAttributes.length > 0 &&
      typeof d.confidence === 'number'
    );
  });

  // Test 21: Returned suggested category ID exists in MongoDB Category collection
  await runCase(21, 'Returned category ID is verified against MongoDB Category collection', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'calculus-textbook-stewart.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    const catId = json.data?.suggestedCategoryId;
    const catInDb = await Category.findById(catId);
    return res.status === 200 && catInDb !== null && catInDb.isActive === true;
  });

  // Test 22: Ambiguous image returns controlled results with warnings and lower confidence
  await runCase(22, 'Ambiguous image returns controlled results with warnings', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'ambiguous-unclear-photo.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    const d = json.data;
    return (
      res.status === 200 &&
      d.confidence <= 0.6 &&
      Array.isArray(d.warnings) &&
      d.warnings.length > 0
    );
  });

  // Test 23: Temporary upload files are cleaned up from disk
  await runCase(23, 'Temporary uploads cleaned up from disk after processing', async () => {
    const tempDir = path.resolve(process.cwd(), 'uploads/temp');
    const filesBefore = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];

    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'cleanup-test-image.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });

    const filesAfter = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
    // The temp directory should not have orphaned files from this request
    return res.status === 200 && filesAfter.length <= filesBefore.length;
  });

  // Test 24: No private metadata or filesystem paths appear in classification response
  await runCase(24, 'Classification response never leaks local filesystem paths or secrets', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'secret-check.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const text = await res.text();
    return (
      !text.includes('uploads/temp') &&
      !text.includes('C:\\') &&
      !text.includes('password') &&
      !text.includes('GEMINI_API_KEY')
    );
  });

  // Test 25: Live provider for image classification without key returns controlled 503
  await runCase(25, 'Live image classification provider without API key returns controlled 503', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([dummyPng], { type: 'image/png' }),
      'live-check.png'
    );

    const res = await fetch(`${BASE}/ai/classify-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-ai-provider': 'gemini',
        'x-bypass-rate-limit': 'true',
      },
      body: formData,
    });
    const json = await res.json();
    return res.status === 503 && json.message?.includes('AI service is not configured');
  });

  // ==========================================
  // REGRESSION TESTS
  // ==========================================

  // Test 26: Frontend api.js exports estimatePrice and classifyProductImage
  await runCase(26, 'Frontend api.js exports estimatePrice and classifyProductImage', async () => {
    const apiPath = path.resolve(__dirname, '../../../frontend/src/services/api.js');
    const content = fs.readFileSync(apiPath, 'utf8');
    return (
      content.includes('estimatePrice:') &&
      content.includes('/ai/estimate-price') &&
      content.includes('classifyProductImage:') &&
      content.includes('/ai/classify-product-image')
    );
  });

  // Test 27: Frontend ProductForm.jsx integrates price estimation and photo classification
  await runCase(27, 'Frontend ProductForm.jsx integrates price estimation and photo classification', async () => {
    const formPath = path.resolve(
      __dirname,
      '../../../frontend/src/components/products/ProductForm.jsx'
    );
    const content = fs.readFileSync(formPath, 'utf8');
    return (
      content.includes('handleEstimatePrice') &&
      content.includes('handleClassifyImage') &&
      content.includes('Estimate Price with AI') &&
      content.includes('Suggest Category from Photo')
    );
  });

  // Test 28: Phase 13A, 13B, and 13C features remain operational
  await runCase(28, 'Phase 13A, 13B, and 13C features remain fully operational', async () => {
    const descRes = await fetch(`${BASE}/ai/product-description`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        title: 'Casio Calculator fx-991EX',
        condition: 'good',
        listingType: 'sell',
      }),
    });

    const searchRes = await fetch(`${BASE}/ai/search-query`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        query: 'Textbooks under 500 taka',
        execute: false,
      }),
    });

    const assistantRes = await fetch(`${BASE}/ai/assistant`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        message: 'How do campus transactions work?',
      }),
    });

    return descRes.status === 200 && searchRes.status === 200 && assistantRes.status === 200;
  });

  // Test 29: Full Regression Cascade (invokes phase13cValidation.js)
  await runCase(29, 'Full Regression Cascade: Run Phase 13C validation suite', async () => {
    console.log('\n--- CASCADING TO PHASE 13C REGRESSION SUITE ---');
    const { ok, code } = await runRegression('phase13cValidation.js');
    console.log(`--- PHASE 13C REGRESSION EXIT CODE: ${code} ---`);
    return ok;
  });

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n=======================================');
  console.log(`PHASE 13D TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase13DValidation().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
