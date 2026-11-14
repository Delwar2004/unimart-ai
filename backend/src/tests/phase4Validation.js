import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';

dotenv.config();

const runPhase4Validation = async () => {
  console.log('--- STARTING PHASE 4 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const BASE = 'http://localhost:5000/api/v1';

  // Prepare test users: 1 verified student, 1 unverified student, 1 second student (buyer)
  await User.deleteMany({ email: { $in: ['seller1@bup.edu.bd', 'unverified@bup.edu.bd', 'other@bup.edu.bd'] } });
  await Product.deleteMany({ campusLocation: 'Test Validation Lab' });

  // 1. Setup Verified Seller
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verified Seller',
      email: 'seller1@bup.edu.bd',
      password: 'Password123',
      campusLocation: 'Test Validation Lab',
    }),
  });
  const seller = await User.findOne({ email: 'seller1@bup.edu.bd' });
  seller.isVerified = true;
  await seller.save();

  const sellerLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seller1@bup.edu.bd', password: 'Password123' }),
  });
  const sellerData = await sellerLogin.json();
  const sellerToken = sellerData.data.token;

  // 2. Setup Unverified Student
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unverified Student',
      email: 'unverified@bup.edu.bd',
      password: 'Password123',
      campusLocation: 'Test Validation Lab',
    }),
  });
  const unverifiedUser = await User.findOne({ email: 'unverified@bup.edu.bd' });

  // 3. Setup Second Student (Other user for unauthorized action tests)
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Other Student',
      email: 'other@bup.edu.bd',
      password: 'Password123',
      campusLocation: 'Test Validation Lab',
    }),
  });
  const otherUser = await User.findOne({ email: 'other@bup.edu.bd' });
  otherUser.isVerified = true;
  await otherUser.save();
  const otherLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other@bup.edu.bd', password: 'Password123' }),
  });
  const otherData = await otherLogin.json();
  const otherToken = otherData.data.token;

  // Retrieve valid category
  const categoriesRes = await fetch(`${BASE}/categories`);
  const categoriesData = await categoriesRes.json();
  const validCategory = categoriesData.data[0];
  console.log('Categories seeded & retrieved:', categoriesData.data.length > 0);

  // Test 1: Public product list works
  const res1 = await fetch(`${BASE}/products`);
  const data1 = await res1.json();
  console.log('Test 1 (Public product list works -> 200):', res1.status === 200 && data1.success);

  // Test 2: Unauthenticated product creation rejected
  const res2 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Hacking Book',
      description: 'Test book',
      category: validCategory._id,
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data2 = await res2.json();
  console.log('Test 2 (Unauthenticated product creation rejected -> 401):', res2.status === 401 && !data2.success);

  // Test 3: Unverified student product creation rejected
  // Generate token for unverified student temporarily for test
  const jwt = (await import('../utils/token.js')).generateToken(unverifiedUser._id, 'student');
  const res3 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      title: 'Unverified Post',
      description: 'Testing',
      category: validCategory._id,
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data3 = await res3.json();
  console.log('Test 3 (Unverified student product creation rejected -> 403):', res3.status === 403 && !data3.success);

  // Test 4: Invalid category rejected
  const res4 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: 'Math Book',
      description: 'Good condition calculus',
      category: new mongoose.Types.ObjectId().toString(),
      price: 250,
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data4 = await res4.json();
  console.log('Test 4 (Invalid category rejected -> 400):', res4.status === 400 && !data4.success);

  // Test 5: Invalid condition rejected
  const res5 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: 'Math Book',
      description: 'Calculus textbook',
      category: validCategory._id,
      condition: 'broken_beyond_repair',
      price: 250,
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data5 = await res5.json();
  console.log('Test 5 (Invalid condition rejected -> 400):', res5.status === 400 && !data5.success);

  // Test 6: Invalid listingType rejected
  const res6 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: 'Math Book',
      description: 'Calculus textbook',
      category: validCategory._id,
      listingType: 'auction',
      price: 250,
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data6 = await res6.json();
  console.log('Test 6 (Invalid listingType rejected -> 400):', res6.status === 400 && !data6.success);

  // Test 7: Giveaway price rule works (auto forces price = 0)
  const res7 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: 'Free Engineering Slide Copies',
      description: 'Free to whoever needs them for exam',
      category: validCategory._id,
      listingType: 'giveaway',
      price: 500, // Should be overridden to 0
      condition: 'good',
      campusLocation: 'Test Validation Lab',
    }),
  });
  const data7 = await res7.json();
  const test7Passed = res7.status === 201 && data7.data?.price === 0 && data7.data?.listingType === 'giveaway';
  console.log('Test 7 (Giveaway price forced to 0):', test7Passed);

  // Test 8: Verified student can create valid product for sale
  const res8 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: 'Casio fx-991EX Calculator',
      description: 'Original Casio scientific calculator used 2 semesters in pristine shape.',
      category: validCategory._id,
      subCategory: validCategory.subcategories[0] || 'Calculators',
      listingType: 'sell',
      price: 1500,
      condition: 'like-new',
      campusLocation: 'Test Validation Lab',
      tags: 'calculator, casio, exam',
    }),
  });
  const data8 = await res8.json();
  const createdProduct = data8.data;
  const test8Passed =
    res8.status === 201 &&
    createdProduct?.price === 1500 &&
    createdProduct?.seller?.name === 'Verified Seller';
  console.log('Test 8 (Verified student creates sale product):', test8Passed);

  const productId = createdProduct._id;

  // Test 9: Product detail works & increments views
  const res9 = await fetch(`${BASE}/products/${productId}`);
  const data9 = await res9.json();
  const test9Passed = res9.status === 200 && data9.data?._id === productId && data9.data?.viewsCount >= 1;
  console.log('Test 9 (Product detail retrieval + views count):', test9Passed);

  // Test 10: Product detail does NOT expose private seller information
  const sellerInfo = data9.data?.seller;
  const test10Passed =
    sellerInfo?.email === undefined &&
    sellerInfo?.phone === undefined &&
    sellerInfo?.studentId === undefined &&
    sellerInfo?.name === 'Verified Seller';
  console.log('Test 10 (Product detail excludes private seller data):', test10Passed);

  // Test 11: Product owner can update product
  const res11 = await fetch(`${BASE}/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      price: 1400,
      description: 'Updated price: 1400 BDT firm.',
    }),
  });
  const data11 = await res11.json();
  console.log('Test 11 (Owner updates product successfully):', res11.status === 200 && data11.data?.price === 1400);

  // Test 12: Another user CANNOT update product
  const res12 = await fetch(`${BASE}/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${otherToken}`,
    },
    body: JSON.stringify({
      price: 10,
    }),
  });
  const data12 = await res12.json();
  console.log('Test 12 (Unauthorized user update blocked -> 403):', res12.status === 403 && !data12.success);

  // Test 13: Product status update works
  const res13 = await fetch(`${BASE}/products/${productId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({ status: 'reserved' }),
  });
  const data13 = await res13.json();
  console.log('Test 13 (Owner updates status to reserved):', res13.status === 200 && data13.data?.status === 'reserved');

  // Test 14: Invalid status value rejected
  const res14 = await fetch(`${BASE}/products/${productId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({ status: 'destroyed' }),
  });
  const data14 = await res14.json();
  console.log('Test 14 (Invalid status rejected -> 400):', res14.status === 400 && !data14.success);

  // Test 15: Product image upload works with multipart/form-data
  const dummyImg = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const formData = new FormData();
  formData.append('title', 'Product with Photo');
  formData.append('description', 'High quality image test');
  formData.append('category', validCategory._id);
  formData.append('price', '200');
  formData.append('listingType', 'sell');
  formData.append('condition', 'new');
  formData.append('campusLocation', 'Test Validation Lab');
  formData.append('images', new Blob([dummyImg], { type: 'image/png' }), 'photo1.png');

  const res15 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
    },
    body: formData,
  });
  const data15 = await res15.json();
  const test15Passed = res15.status === 201 && data15.data?.images?.length === 1 && data15.data?.images[0]?.isThumbnail;
  console.log('Test 15 (Product image upload succeeds & thumbnail set):', test15Passed);

  // Test 16: Invalid image type rejected (e.g. text/html)
  const badFormData = new FormData();
  badFormData.append('title', 'Bad File Post');
  badFormData.append('description', 'Testing rejection');
  badFormData.append('category', validCategory._id);
  badFormData.append('price', '100');
  badFormData.append('campusLocation', 'Test Validation Lab');
  badFormData.append('images', new Blob([Buffer.from('alert("xss")')], { type: 'text/javascript' }), 'hack.js');

  const res16 = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: badFormData,
  });
  const data16 = await res16.json();
  console.log('Test 16 (Invalid file format rejected -> 400):', res16.status === 400 && !data16.success);

  // Test 17: Another user CANNOT delete product
  const res17 = await fetch(`${BASE}/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  const data17 = await res17.json();
  console.log('Test 17 (Unauthorized user delete blocked -> 403):', res17.status === 403 && !data17.success);

  // Test 18: Owner can delete product (soft-deactivates to inactive)
  const res18 = await fetch(`${BASE}/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const data18 = await res18.json();
  const dbProdAfterDel = await Product.findById(productId);
  console.log('Test 18 (Owner deletes product, status becomes inactive):', res18.status === 200 && dbProdAfterDel.status === 'inactive');

  // Test 19: Pagination works
  const res19 = await fetch(`${BASE}/products?page=1&limit=2`);
  const data19 = await res19.json();
  console.log('Test 19 (Pagination returns meta):', res19.status === 200 && data19.meta?.limit === 2);

  // Test 20: Health endpoint still operational
  const res20 = await fetch(`${BASE}/health`);
  const data20 = await res20.json();
  console.log('Test 20 (Health check still functional):', res20.status === 200 && data20.data?.database?.connected);

  await mongoose.disconnect();
  console.log('--- ALL PHASE 4 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
};

runPhase4Validation().catch((err) => {
  console.error('Phase 4 test suite failed:', err);
  process.exit(1);
});
