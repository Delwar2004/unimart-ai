/**
 * UniMart AI — Automated Security, RBAC & Vulnerability Audit Test Suite
 * Tests all requirements from the Master Prompt:
 * - Authentication & Authorization (Admin vs Student)
 * - Strict RBAC (No student access to admin APIs)
 * - Privilege Escalation Prevention (Role tampering blocked)
 * - NoSQL Injection Resilience
 * - IDOR & Ownership Enforcement
 * - Invalid ObjectId Format Handling (Zero 500 CastErrors)
 * - Security Headers & Information Disclosure Protection
 * - Rate Limiting & Throttling
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { USER_ROLES, PRODUCT_STATUS, LISTING_TYPES, PRODUCT_CONDITIONS } from '../constants/index.js';
import { generateToken } from '../utils/token.js';

let baseUrl = 'http://127.0.0.1:5000/api/v1';

const results = [];

const logTest = (name, passed, details = '') => {
  results.push({ name, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${details ? `(${details})` : ''}`);
};

const makeRequest = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  let json = null;
  try {
    json = await response.json();
  } catch {
    // not json
  }
  return { status: response.status, headers: response.headers, data: json };
};

const runAudit = async () => {
  console.log('===============================================================');
  console.log('   UNIMART AI - AUTOMATED COMPREHENSIVE SECURITY AUDIT SUITE   ');
  console.log('===============================================================\n');

  // Connect to active MongoDB instance
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/unimart_ai');
  }

  // Ensure Admin and Student test users exist
  let admin = await User.findOne({ email: 'admin@bup.edu.bd' });
  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: 'admin@bup.edu.bd',
      passwordHash: '$2a$12$eX.kFj6W.7wT9z3H7hN8Q.8H8E0N8H8E0N8H8E0N8H8E0N8H8E0N8',
      role: USER_ROLES.ADMIN,
      isVerified: true,
      campusLocation: 'Mirpur Campus',
    });
  }

  let studentA = await User.findOne({ email: 'student@bup.edu.bd' });
  if (!studentA) {
    studentA = await User.create({
      name: 'Student One',
      email: 'student@bup.edu.bd',
      studentId: 'STU1001',
      passwordHash: '$2a$12$eX.kFj6W.7wT9z3H7hN8Q.8H8E0N8H8E0N8H8E0N8H8E0N8H8E0N8',
      role: USER_ROLES.STUDENT,
      isVerified: true,
      campusLocation: 'Mirpur Campus',
    });
  }

  let studentB = await User.findOne({ email: 'studentb@bup.edu.bd' });
  if (!studentB) {
    studentB = await User.create({
      name: 'Student Two',
      email: 'studentb@bup.edu.bd',
      studentId: 'STU1002',
      passwordHash: '$2a$12$eX.kFj6W.7wT9z3H7hN8Q.8H8E0N8H8E0N8H8E0N8H8E0N8H8E0N8',
      role: USER_ROLES.STUDENT,
      isVerified: true,
      campusLocation: 'Mirpur Campus',
    });
  }

  const adminToken = generateToken(admin);
  const studentAToken = generateToken(studentA);
  const studentBToken = generateToken(studentB);

  // Ensure test category and products exist
  let testCategory = await Category.findOne({});
  if (!testCategory) {
    testCategory = await Category.create({
      name: 'Electronics & Gadgets',
      slug: 'electronics-gadgets',
      description: 'Tech accessories',
    });
  }

  const productB = await Product.create({
    title: 'Student B Laptop Stand',
    description: 'Ergonomic aluminum stand',
    category: testCategory._id,
    seller: studentB._id,
    price: 1200,
    listingType: LISTING_TYPES.SELL,
    condition: PRODUCT_CONDITIONS.EXCELLENT,
    campusLocation: 'Mirpur Campus',
    status: PRODUCT_STATUS.AVAILABLE,
  });

  // -------------------------------------------------------------
  // TEST GROUP 1: SECURITY HEADERS & INFORMATION LEAKAGE
  // -------------------------------------------------------------
  console.log('\n--- GROUP 1: Security Headers & Info Leakage ---');
  const healthRes = await makeRequest('/health');
  logTest(
    'X-Content-Type-Options: nosniff header present',
    healthRes.headers.get('x-content-type-options') === 'nosniff'
  );
  logTest(
    'X-Frame-Options: DENY header present (Clickjacking protection)',
    healthRes.headers.get('x-frame-options') === 'DENY'
  );
  logTest(
    'X-Powered-By header is disabled (Express fingerprinting prevention)',
    healthRes.headers.get('x-powered-by') === null
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN APIS
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: Strict RBAC & Admin Access Barriers ---');
  
  // Unauthenticated access to Admin Reports
  const unauthAdminRes = await makeRequest('/admin/reports');
  logTest(
    'Unauthenticated user accessing /api/v1/admin/reports receives HTTP 401 Unauthorized',
    unauthAdminRes.status === 401
  );

  // Student accessing Admin Reports
  const studentAdminRes = await makeRequest('/admin/reports', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  logTest(
    'Student accessing /api/v1/admin/reports receives HTTP 403 Forbidden',
    studentAdminRes.status === 403
  );

  // Student accessing Admin Analytics Overview
  const studentAnalyticsRes = await makeRequest('/admin/analytics/overview', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  logTest(
    'Student accessing /api/v1/admin/analytics/overview receives HTTP 403 Forbidden',
    studentAnalyticsRes.status === 403
  );

  // Authorized Admin accessing Admin Reports
  const authorizedAdminRes = await makeRequest('/admin/reports', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  logTest(
    'Authorized Admin accessing /api/v1/admin/reports receives HTTP 200 OK',
    authorizedAdminRes.status === 200
  );

  // Authorized Admin accessing Admin Analytics
  const authorizedAnalyticsRes = await makeRequest('/admin/analytics/overview', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  logTest(
    'Authorized Admin accessing /api/v1/admin/analytics/overview receives HTTP 200 OK',
    authorizedAnalyticsRes.status === 200
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: PRIVILEGE ESCALATION & MASS ASSIGNMENT
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: Privilege Escalation & Mass Assignment ---');
  
  // Student attempting to change role to admin via profile update
  const escalationRes = await makeRequest('/users/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'admin',
      isVerified: true,
      bio: 'Legitimate student bio update',
    }),
  });
  const reloadedStudentA = await User.findById(studentA._id);
  logTest(
    'Student cannot escalate role to admin via profile update API',
    reloadedStudentA.role === USER_ROLES.STUDENT,
    `Current role: ${reloadedStudentA.role}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: NoSQL INJECTION DEFENSE & TYPE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: NoSQL Injection & Input Type Checking ---');
  
  // NoSQL injection payload on login endpoint
  const nosqlRes = await makeRequest('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: { $gt: '' },
      password: { $gt: '' },
    }),
  });
  logTest(
    'NoSQL injection payload { email: { $gt: "" } } is blocked with HTTP 400 Bad Request',
    nosqlRes.status === 400
  );

  // -------------------------------------------------------------
  // TEST GROUP 5: IDOR & OWNERSHIP VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: IDOR & Product Ownership Protection ---');
  
  // Student A attempts to update Student B's product
  const idorUpdateRes = await makeRequest(`/products/${productB._id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Hacked Title by Student A',
      price: 1,
    }),
  });
  logTest(
    'Student A attempting to modify Student B product receives HTTP 403 Forbidden',
    idorUpdateRes.status === 403
  );

  // Verify product wasn't modified
  const untouchedProductB = await Product.findById(productB._id);
  logTest(
    'Target product data remains untampered in database',
    untouchedProductB.title === 'Student B Laptop Stand' && untouchedProductB.price === 1200
  );

  // -------------------------------------------------------------
  // TEST GROUP 6: OBJECTID VALIDATION (PREVENTS 500 CRASHES)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 6: Safe ObjectId Handling (No 500 Crashes) ---');
  
  const invalidProductRes = await makeRequest('/products/invalid-id-string');
  logTest(
    'Invalid product ID returns clean HTTP 400 instead of 500 CastError',
    invalidProductRes.status === 400
  );

  const invalidUserRes = await makeRequest('/users/invalid-user-id');
  logTest(
    'Invalid user ID returns clean HTTP 400 instead of 500 CastError',
    invalidUserRes.status === 400
  );

  // -------------------------------------------------------------
  // TEST GROUP 7: RATE LIMITING RESILIENCE
  // -------------------------------------------------------------
  console.log('\n--- GROUP 7: Rate Limiting & Throttling ---');
  
  let rateLimited = false;
  for (let i = 0; i < 265; i++) {
    const res = await makeRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `test${i}@bup.edu.bd`, password: 'WrongPassword123' }),
    });
    if (res.status === 429) {
      rateLimited = true;
      break;
    }
  }
  logTest(
    'Auth rate limiter triggers HTTP 429 Too Many Requests on rapid credential requests',
    rateLimited
  );

  // -------------------------------------------------------------
  // AUDIT SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`AUDIT RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} TESTS`);
  console.log('===============================================================\n');

  process.exit(failedCount === 0 ? 0 : 1);
};

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
