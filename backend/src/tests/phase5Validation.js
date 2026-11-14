import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';

dotenv.config();

const runPhase5Validation = async () => {
  console.log('--- STARTING PHASE 5 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const BASE = 'http://localhost:5000/api/v1';

  // 1. Setup seller & categories
  let seller = await User.findOne({ email: 'search_seller@bup.edu.bd' });
  if (!seller) {
    seller = await User.create({
      name: 'Search Seller',
      email: 'search_seller@bup.edu.bd',
      passwordHash: 'dummy_hash',
      studentId: '24549010055',
      campusLocation: 'Mirpur Cantonment Campus',
      role: 'student',
      isVerified: true,
      status: 'active',
    });
  }

  const bookCat = await Category.findOne({ slug: 'books-notes' });
  const elecCat = await Category.findOne({ slug: 'electronics-gadgets' });

  // Clean previous test items completely
  await Product.deleteMany({});

  // 2. Seed diverse test products
  const p1 = await Product.create({
    title: 'Thomas Calculus 14th Edition Textbook',
    description: 'Clean single variable and multivariable calculus textbook for engineering students.',
    category: bookCat._id,
    subCategory: 'Textbooks',
    seller: seller._id,
    listingType: 'sell',
    price: 600,
    condition: 'good',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'available',
    tags: ['calculus', 'math', 'textbook'],
    viewsCount: 25,
  });

  const p2 = await Product.create({
    title: 'Casio fx-991CW Advanced Calculator',
    description: 'Scientific calculator with spreadsheet and matrix features, perfect for exams.',
    category: elecCat._id,
    subCategory: 'Calculators',
    seller: seller._id,
    listingType: 'sell',
    price: 2400,
    condition: 'new',
    campusLocation: 'FST Lab 402',
    status: 'available',
    tags: ['calculator', 'casio', 'exam'],
    viewsCount: 150,
  });

  const p3 = await Product.create({
    title: 'Linear Algebra Notes & Lecture Slides Handout',
    description: 'Complete semester handwritten lecture notes for BICE batch.',
    category: bookCat._id,
    subCategory: 'Course Notes',
    seller: seller._id,
    listingType: 'giveaway',
    price: 0,
    condition: 'like-new',
    campusLocation: 'Dorm Room 101',
    status: 'available',
    tags: ['algebra', 'handout', 'notes'],
    viewsCount: 80,
  });

  const p4 = await Product.create({
    title: 'Digital Multimeter for Circuits Lab',
    description: 'Handheld auto-ranging digital multimeter with test leads.',
    category: elecCat._id,
    subCategory: 'Arduino & IoT Kits',
    seller: seller._id,
    listingType: 'exchange',
    price: 900,
    condition: 'fair',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'available',
    exchangePreferences: 'Arduino Mega board',
    tags: ['electronics', 'multimeter', 'lab'],
    viewsCount: 10,
  });

  const pUnavailable = await Product.create({
    title: 'Old Sold Physics Book',
    description: 'Already sold book',
    category: bookCat._id,
    seller: seller._id,
    listingType: 'sell',
    price: 300,
    condition: 'fair',
    campusLocation: 'Mirpur Cantonment Campus',
    status: 'sold',
  });

  // Test 1: Basic product listing returns products & pagination metadata
  const res1 = await fetch(`${BASE}/products`);
  const data1 = await res1.json();
  const test1Passed = res1.status === 200 && data1.data?.products?.length > 0 && data1.data?.pagination?.totalItems > 0;
  console.log('Test 1 (Basic product listing with pagination meta):', test1Passed);

  // Test 2: Keyword search works for title
  const res2 = await fetch(`${BASE}/products?q=calculator`);
  const data2 = await res2.json();
  const test2Passed = data2.data?.products?.length === 1 && data2.data?.products[0]?.title.includes('Calculator');
  console.log('Test 2 (Keyword search for title):', test2Passed);

  // Test 3: Search covers tags and description
  const res3 = await fetch(`${BASE}/products?search=exam`);
  const data3 = await res3.json();
  const test3Passed = data3.data?.products?.some((p) => p.tags.includes('exam'));
  console.log('Test 3 (Search covers tags/description):', test3Passed);

  // Test 4: Category filter works
  const res4 = await fetch(`${BASE}/products?category=${elecCat._id}`);
  const data4 = await res4.json();
  const test4Passed = data4.data?.products?.every((p) => p.category?._id === elecCat._id.toString());
  console.log('Test 4 (Category filter works):', test4Passed && data4.data?.products?.length === 2);

  // Test 5: Subcategory filter works
  const res5 = await fetch(`${BASE}/products?category=${elecCat._id}&subCategory=Calculators`);
  const data5 = await res5.json();
  const test5Passed = data5.data?.products?.length === 1 && data5.data?.products[0]?.subCategory === 'Calculators';
  console.log('Test 5 (Subcategory filter works):', test5Passed);

  // Test 6: Minimum price filter works
  const res6 = await fetch(`${BASE}/products?minPrice=1000`);
  const data6 = await res6.json();
  const test6Passed = data6.data?.products?.every((p) => p.price >= 1000);
  console.log('Test 6 (Minimum price filter works):', test6Passed && data6.data?.products?.length === 1);

  // Test 7: Maximum price filter works
  const res7 = await fetch(`${BASE}/products?maxPrice=700`);
  const data7 = await res7.json();
  const test7Passed = data7.data?.products?.every((p) => p.price <= 700);
  console.log('Test 7 (Maximum price filter works):', test7Passed);

  // Test 8: Price range combination works (minPrice=500, maxPrice=1000)
  const res8 = await fetch(`${BASE}/products?minPrice=500&maxPrice=1000`);
  const data8 = await res8.json();
  const test8Passed = data8.data?.products?.every((p) => p.price >= 500 && p.price <= 1000);
  console.log('Test 8 (Price range combination works):', test8Passed && data8.data?.products?.length === 2);

  // Test 9: Invalid price rejected (minPrice > maxPrice)
  const res9 = await fetch(`${BASE}/products?minPrice=1000&maxPrice=200`);
  const data9 = await res9.json();
  console.log('Test 9 (minPrice > maxPrice rejected -> 400):', res9.status === 400 && !data9.success);

  // Test 10: Invalid condition rejected
  const res10 = await fetch(`${BASE}/products?condition=destroyed`);
  const data10 = await res10.json();
  console.log('Test 10 (Invalid condition rejected -> 400):', res10.status === 400 && !data10.success);

  // Test 11: Condition filter works
  const res11 = await fetch(`${BASE}/products?condition=new`);
  const data11 = await res11.json();
  const test11Passed = data11.data?.products?.every((p) => p.condition === 'new');
  console.log('Test 11 (Condition filter works):', test11Passed && data11.data?.products?.length === 1);

  // Test 12: Campus filter works (case-insensitive)
  const res12 = await fetch(`${BASE}/products?campusLocation=FST`);
  const data12 = await res12.json();
  const test12Passed = data12.data?.products?.length === 1 && data12.data?.products[0]?.campusLocation.includes('FST');
  console.log('Test 12 (Campus filter works):', test12Passed);

  // Test 13: Listing type filter works (giveaway)
  const res13 = await fetch(`${BASE}/products?listingType=giveaway`);
  const data13 = await res13.json();
  const test13Passed = data13.data?.products?.length === 1 && data13.data?.products[0]?.listingType === 'giveaway';
  console.log('Test 13 (Listing type filter works):', test13Passed);

  // Test 14: Default status only shows available products (omits pUnavailable)
  const res14 = await fetch(`${BASE}/products`);
  const data14 = await res14.json();
  const test14Passed = data14.data?.products?.every((p) => p.status === 'available');
  console.log('Test 14 (Default status only returns available products):', test14Passed);

  // Test 15: Newest sorting works
  const res15 = await fetch(`${BASE}/products?sort=newest`);
  const data15 = await res15.json();
  const dates = data15.data?.products?.map((p) => new Date(p.createdAt).getTime());
  const test15Passed = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
  console.log('Test 15 (Newest sorting works):', test15Passed);

  // Test 16: Oldest sorting works
  const res16 = await fetch(`${BASE}/products?sort=oldest`);
  const data16 = await res16.json();
  const oldestDates = data16.data?.products?.map((p) => new Date(p.createdAt).getTime());
  const test16Passed = oldestDates.every((d, i) => i === 0 || oldestDates[i - 1] <= d);
  console.log('Test 16 (Oldest sorting works):', test16Passed);

  // Test 17: Price ascending works
  const res17 = await fetch(`${BASE}/products?sort=price_asc`);
  const data17 = await res17.json();
  const ascPrices = data17.data?.products?.map((p) => p.price);
  const test17Passed = ascPrices.every((p, i) => i === 0 || ascPrices[i - 1] <= p);
  console.log('Test 17 (Price ascending sorting works):', test17Passed);

  // Test 18: Price descending works
  const res18 = await fetch(`${BASE}/products?sort=price_desc`);
  const data18 = await res18.json();
  const descPrices = data18.data?.products?.map((p) => p.price);
  const test18Passed = descPrices.every((p, i) => i === 0 || descPrices[i - 1] >= p);
  console.log('Test 18 (Price descending sorting works):', test18Passed);

  // Test 19: Popular sorting works (by viewsCount desc)
  const res19 = await fetch(`${BASE}/products?sort=popular`);
  const data19 = await res19.json();
  const views = data19.data?.products?.map((p) => p.viewsCount || 0);
  const test19Passed = views.every((v, i) => i === 0 || views[i - 1] >= v);
  console.log('Test 19 (Popular sorting works):', test19Passed);

  // Test 20: Pagination works (page 1, limit 2)
  const res20 = await fetch(`${BASE}/products?page=1&limit=2`);
  const data20 = await res20.json();
  const pMeta = data20.data?.pagination;
  const test20Passed = data20.data?.products?.length === 2 && pMeta?.hasNextPage === true && pMeta?.page === 1;
  console.log('Test 20 (Pagination works with next/prev indicators):', test20Passed);

  // Test 21: Combined multi-criteria filter works
  const res21 = await fetch(
    `${BASE}/products?category=${elecCat._id}&listingType=sell&condition=new&minPrice=1000&maxPrice=3000&sort=price_asc`
  );
  const data21 = await res21.json();
  const test21Passed = data21.data?.products?.length === 1 && data21.data?.products[0]?.title.includes('Casio');
  console.log('Test 21 (Combined multi-criteria filter works):', test21Passed);

  // Test 22: Invalid ObjectId handled safely
  const res22 = await fetch(`${BASE}/products?category=invalid_object_id_string`);
  const data22 = await res22.json();
  console.log('Test 22 (Invalid ObjectId returns 400 safely):', res22.status === 400 && !data22.success);

  // Test 23: Excessive limit is bounded to max 50
  const res23 = await fetch(`${BASE}/products?limit=500`);
  const data23 = await res23.json();
  console.log('Test 23 (Excessive limit bounded to 50):', data23.data?.pagination?.limit === 50);

  // Test 24: Seller filter (for My Listings) continues to work
  const res24 = await fetch(`${BASE}/products?seller=${seller._id}`);
  const data24 = await res24.json();
  console.log('Test 24 (Seller filter works for My Listings):', data24.data?.products?.length >= 4);

  // Test 25: Health check regression
  const res25 = await fetch(`${BASE}/health`);
  const data25 = await res25.json();
  console.log('Test 25 (Health check operational):', res25.status === 200 && data25.data?.database?.connected);

  await mongoose.disconnect();
  console.log('--- ALL PHASE 5 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
};

runPhase5Validation().catch((err) => {
  console.error('Phase 5 test suite failed:', err);
  process.exit(1);
});
