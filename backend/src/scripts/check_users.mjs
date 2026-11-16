import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User } from '../models/User.js';

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/unimart_ai');
    
    const totalUsers = await User.countDocuments();
    const latestUsers = await User.find()
      .select('name email role studentId department isVerified isBanned createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log('\n=============================================================');
    console.log(` 👥 UNIMART AI - USER DATABASE CHECK (Total: ${totalUsers})`);
    console.log('=============================================================');

    if (latestUsers.length === 0) {
      console.log(' No users found in the database.');
    } else {
      latestUsers.forEach((u, idx) => {
        const verifyTag = u.isVerified ? '✅ Verified' : '⏳ Pending';
        const banTag = u.isBanned ? '⛔ Banned' : '🟢 Active';
        console.log(`\n[${idx + 1}] ${u.name} (${u.email})`);
        console.log(`    Role: ${u.role} | Student ID: ${u.studentId || 'N/A'}`);
        console.log(`    Dept: ${u.department || 'General'} | Status: ${banTag} | Email: ${verifyTag}`);
        console.log(`    Registered: ${new Date(u.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`);
      });
    }

    console.log('\n=============================================================\n');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
}

listUsers();
