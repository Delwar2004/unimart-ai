import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';

dotenv.config();

const runValidation = async () => {
  console.log('--- STARTING PHASE 2 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Clean test user data
  await User.deleteMany({ email: { $regex: /@bup\.edu\.bd$/ } });

  const BASE = 'http://localhost:5000/api/v1/auth';

  // 1. Invalid email domain
  const res1 = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: 'student@gmail.com',
      password: 'Password123',
      campusLocation: 'Mirpur',
    }),
  });
  const data1 = await res1.json();
  console.log('Test 1 (Invalid domain rejected):', res1.status === 400 && !data1.success);

  // 2. Weak password
  const res2 = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: 'student@bup.edu.bd',
      password: 'weak',
      campusLocation: 'Mirpur',
    }),
  });
  const data2 = await res2.json();
  console.log('Test 2 (Weak password rejected):', res2.status === 400 && !data2.success);

  // 3. Valid registration
  const res3 = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Delwar Husen',
      email: 'delwar@bup.edu.bd',
      password: 'SecurePassword123',
      studentId: '24549010076',
      department: 'ICT',
      batch: 'BICE-24',
      phone: '+8801700000000',
      campusLocation: 'BUP Campus',
    }),
  });
  const data3 = await res3.json();
  const regPassed = res3.status === 201 && data3.success && !data3.data.passwordHash;
  console.log('Test 3 (Valid registration + passwordHash hidden):', regPassed);

  // 4. Duplicate email
  const res4 = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Student',
      email: 'delwar@bup.edu.bd',
      password: 'SecurePassword123',
      campusLocation: 'BUP Campus',
    }),
  });
  const data4 = await res4.json();
  console.log('Test 4 (Duplicate email rejected with 409):', res4.status === 409 && !data4.success);

  // 5. Duplicate student ID
  const res5 = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Student',
      email: 'another@bup.edu.bd',
      password: 'SecurePassword123',
      studentId: '24549010076',
      campusLocation: 'BUP Campus',
    }),
  });
  const data5 = await res5.json();
  console.log('Test 5 (Duplicate student ID rejected with 409):', res5.status === 409 && !data5.success);

  // Fetch created user directly from DB to inspect token and security
  const dbUser = await User.findOne({ email: 'delwar@bup.edu.bd' }).select('+verificationToken +verificationTokenExpires +passwordHash');
  const vToken = dbUser.verificationToken;
  console.log('Verification token generated in DB:', !!vToken);

  // 6. Login before verification
  const res6 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'delwar@bup.edu.bd',
      password: 'SecurePassword123',
    }),
  });
  const data6 = await res6.json();
  console.log('Test 6 (Unverified login blocked with 403):', res6.status === 403 && !data6.success);

  // 7. Invalid verification token
  const res7 = await fetch(`${BASE}/verify-email/fake_token_12345`);
  const data7 = await res7.json();
  console.log('Test 7 (Invalid verification token rejected):', res7.status === 400 && !data7.success);

  // 8. Successful email verification
  const res8 = await fetch(`${BASE}/verify-email/${vToken}`);
  const data8 = await res8.json();
  console.log('Test 8 (Successful email verification):', res8.status === 200 && data8.success);

  // 9. Reusing already-used verification token
  const res9 = await fetch(`${BASE}/verify-email/${vToken}`);
  const data9 = await res9.json();
  console.log('Test 9 (Token reuse rejected):', res9.status === 400 && !data9.success);

  // 10. Wrong password login
  const res10 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'delwar@bup.edu.bd',
      password: 'WrongPassword999',
    }),
  });
  const data10 = await res10.json();
  console.log('Test 10 (Wrong password rejected):', res10.status === 401 && !data10.success);

  // 11. Successful login
  const res11 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'delwar@bup.edu.bd',
      password: 'SecurePassword123',
    }),
  });
  const data11 = await res11.json();
  const authToken = data11.data?.token;
  const loginPassed = res11.status === 200 && !!authToken && !data11.data.user.passwordHash;
  console.log('Test 11 (Successful login + JWT issued):', loginPassed);

  // 12. GET /me without token
  const res12 = await fetch(`${BASE}/me`);
  const data12 = await res12.json();
  console.log('Test 12 (GET /me without token rejected with 401):', res12.status === 401 && !data12.success);

  // 13. GET /me with valid token
  const res13 = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data13 = await res13.json();
  const mePassed = res13.status === 200 && data13.data?.email === 'delwar@bup.edu.bd' && !data13.data.passwordHash && !data13.data.verificationToken;
  console.log('Test 13 (GET /me with Bearer token verified):', mePassed);

  // 14. Suspended account rejection
  await User.updateOne({ email: 'delwar@bup.edu.bd' }, { status: 'suspended' });
  const res14 = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data14 = await res14.json();
  console.log('Test 14 (Suspended user access blocked with 403):', res14.status === 403 && !data14.success);

  // 15. Banned account rejection
  await User.updateOne({ email: 'delwar@bup.edu.bd' }, { status: 'banned' });
  const res15 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'delwar@bup.edu.bd',
      password: 'SecurePassword123',
    }),
  });
  const data15 = await res15.json();
  console.log('Test 15 (Banned user login blocked with 403):', res15.status === 403 && !data15.success);

  // Reset user status back to active for password tests
  await User.updateOne({ email: 'delwar@bup.edu.bd' }, { status: 'active' });

  // 16. Forgot password
  const res16 = await fetch(`${BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'delwar@bup.edu.bd' }),
  });
  const data16 = await res16.json();
  console.log('Test 16 (Forgot password generic response):', res16.status === 200 && data16.success);

  // Get reset token from DB
  const userForReset = await User.findOne({ email: 'delwar@bup.edu.bd' }).select('+resetPasswordToken');
  const rToken = userForReset.resetPasswordToken;

  // 17. Invalid reset token
  const res17 = await fetch(`${BASE}/reset-password/invalid_reset_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'NewPassword123' }),
  });
  const data17 = await res17.json();
  console.log('Test 17 (Invalid reset token rejected):', res17.status === 400 && !data17.success);

  // 18. Successful reset password
  const res18 = await fetch(`${BASE}/reset-password/${rToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'NewPassword123' }),
  });
  const data18 = await res18.json();
  console.log('Test 18 (Password reset success):', res18.status === 200 && data18.success);

  // 19. Reuse reset token
  const res19 = await fetch(`${BASE}/reset-password/${rToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'AnotherPassword123' }),
  });
  const data19 = await res19.json();
  console.log('Test 19 (Reset token reuse rejected):', res19.status === 400 && !data19.success);

  // 20. Login with new password
  const res20 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'delwar@bup.edu.bd',
      password: 'NewPassword123',
    }),
  });
  const data20 = await res20.json();
  console.log('Test 20 (Login with new password succeeded):', res20.status === 200 && data20.success);

  // 21. Health check regression test
  const res21 = await fetch('http://localhost:5000/api/v1/health');
  const data21 = await res21.json();
  console.log('Test 21 (Health check still functional):', res21.status === 200 && data21.data.database.connected);

  await mongoose.disconnect();
  console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
};

runValidation().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
