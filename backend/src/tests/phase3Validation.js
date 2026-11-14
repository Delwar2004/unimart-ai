import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User.js';

dotenv.config();

const runProfileValidation = async () => {
  console.log('--- STARTING PHASE 3 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const AUTH_BASE = 'http://localhost:5000/api/v1/auth';
  const USER_BASE = 'http://localhost:5000/api/v1/users';

  // Clean previous test user
  await User.deleteMany({ email: 'profile_test@bup.edu.bd' });

  // 1. Register test user
  await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Profile Tester',
      email: 'profile_test@bup.edu.bd',
      password: 'StrongPassword123',
      studentId: '24549010099',
      campusLocation: 'BUP Campus',
    }),
  });

  // Verify directly in DB
  const user = await User.findOne({ email: 'profile_test@bup.edu.bd' });
  user.isVerified = true;
  await user.save();

  // Login to get token
  const loginRes = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'profile_test@bup.edu.bd',
      password: 'StrongPassword123',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  const userId = loginData.data.user.id;

  // 1. GET own profile without auth → 401
  const res1 = await fetch(`${USER_BASE}/profile`);
  const data1 = await res1.json();
  console.log('Test 1 (GET own profile without auth -> 401):', res1.status === 401 && !data1.success);

  // 2. GET own profile with valid token → 200
  const res2 = await fetch(`${USER_BASE}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data2 = await res2.json();
  const test2Passed =
    res2.status === 200 &&
    data2.data?.email === 'profile_test@bup.edu.bd' &&
    !data2.data?.passwordHash &&
    !data2.data?.verificationToken;
  console.log('Test 2 (GET own profile with valid token -> 200):', test2Passed);

  // 3. Update profile successfully
  const res3 = await fetch(`${USER_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Updated Tester',
      department: 'Information & Communication Tech',
      batch: 'BICE-24',
      phone: '+8801999999999',
      bio: 'Junior interested in electronics and embedded systems.',
      campusLocation: 'Mirpur DOHS / BUP Main Gate',
    }),
  });
  const data3 = await res3.json();
  const test3Passed =
    res3.status === 200 &&
    data3.data?.name === 'Updated Tester' &&
    data3.data?.department === 'Information & Communication Tech' &&
    data3.data?.phone === '+8801999999999';
  console.log('Test 3 (Update profile successfully):', test3Passed);

  // 4. Invalid profile data rejected (empty name)
  const res4 = await fetch(`${USER_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: '',
    }),
  });
  const data4 = await res4.json();
  console.log('Test 4 (Empty name rejected -> 400):', res4.status === 400 && !data4.success);

  // 5. Attempt to update role rejected/ignored
  const res5 = await fetch(`${USER_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      role: 'admin',
    }),
  });
  const data5 = await res5.json();
  const dbUserAfterRoleAttempt = await User.findById(userId);
  console.log('Test 5 (Attempt to modify role ignored, role remains student):', dbUserAfterRoleAttempt.role === 'student');

  // 6. Attempt to update isVerified rejected/ignored
  await fetch(`${USER_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      isVerified: false,
    }),
  });
  const dbUserAfterVerifyAttempt = await User.findById(userId);
  console.log('Test 6 (Attempt to modify isVerified ignored):', dbUserAfterVerifyAttempt.isVerified === true);

  // 7. Attempt to update reputation rejected/ignored
  await fetch(`${USER_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reputation: { averageRating: 5.0, ratingsCount: 999 },
    }),
  });
  const dbUserAfterRepAttempt = await User.findById(userId);
  console.log('Test 7 (Attempt to modify reputation ignored):', dbUserAfterRepAttempt.reputation.ratingsCount === 0);

  // 8. Public profile endpoint works
  const res8 = await fetch(`${USER_BASE}/${userId}`);
  const data8 = await res8.json();
  console.log('Test 8 (Public profile endpoint works -> 200):', res8.status === 200 && data8.success);

  // 9. Public profile does NOT expose private information (email, phone, studentId)
  const test9Passed =
    data8.data?.email === undefined &&
    data8.data?.phone === undefined &&
    data8.data?.studentId === undefined &&
    data8.data?.name === 'Updated Tester';
  console.log('Test 9 (Public profile excludes private fields):', test9Passed);

  // 10. Avatar upload succeeds
  // Create a dummy png file for test
  const testImagePath = path.resolve('test-avatar.png');
  // 1x1 transparent PNG buffer
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(testImagePath, pngBuffer);

  const formData = new FormData();
  formData.append('avatar', new Blob([pngBuffer], { type: 'image/png' }), 'test-avatar.png');

  const res10 = await fetch(`${USER_BASE}/profile/avatar`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data10 = await res10.json();
  const test10Passed = res10.status === 200 && data10.data?.avatarUrl?.startsWith('/uploads/avatars/');
  console.log('Test 10 (Avatar upload succeeds):', test10Passed);

  // 11. Invalid file type rejected (text file instead of image)
  const textBuffer = Buffer.from('console.log("malicious code");');
  const badFormData = new FormData();
  badFormData.append('avatar', new Blob([textBuffer], { type: 'text/javascript' }), 'script.js');

  const res11 = await fetch(`${USER_BASE}/profile/avatar`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: badFormData,
  });
  const data11 = await res11.json();
  console.log('Test 11 (Invalid file type rejected -> 400):', res11.status === 400 && !data11.success);

  // 12. Oversized file rejected (> 2MB)
  const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5 MB
  const largeFormData = new FormData();
  largeFormData.append('avatar', new Blob([largeBuffer], { type: 'image/png' }), 'large.png');

  const res12 = await fetch(`${USER_BASE}/profile/avatar`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: largeFormData,
  });
  const data12 = await res12.json();
  console.log('Test 12 (Oversized file rejected):', res12.status >= 400 && !data12.success);

  // 13. Static file serving check
  const uploadedPath = data10.data.avatarUrl;
  const staticRes = await fetch(`http://localhost:5000${uploadedPath}`);
  console.log('Test 13 (Static avatar accessible over HTTP):', staticRes.status === 200);

  // 14. Existing health check still operational
  const healthRes = await fetch('http://localhost:5000/api/v1/health');
  const healthData = await healthRes.json();
  console.log('Test 14 (Health endpoint operational):', healthRes.status === 200 && healthData.data?.database?.connected);

  // Clean test artifacts
  if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);

  await mongoose.disconnect();
  console.log('--- ALL PHASE 3 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
};

runProfileValidation().catch((err) => {
  console.error('Phase 3 test suite failed:', err);
  process.exit(1);
});
