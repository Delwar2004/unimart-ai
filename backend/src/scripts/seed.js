import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, syncUserIndexes } from '../config/db.js';
import { seedCategories } from '../config/categorySeed.js';
import { seedDemoData } from '../config/demoSeed.js';

dotenv.config();

const runSeeder = async () => {
  console.log('--- Starting UniMart AI Database Seeding ---');
  await connectDB();
  await syncUserIndexes();
  await seedCategories();
  await seedDemoData(true);
  console.log('--- Seeding Completed Successfully! ---');
  await mongoose.disconnect();
  process.exit(0);
};

runSeeder().catch((err) => {
  console.error('Seeding failed with error:', err);
  process.exit(1);
});
