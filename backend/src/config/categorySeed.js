import mongoose from 'mongoose';
import { Category } from '../models/Category.js';

export const initialCategories = [
  {
    name: 'Books & Notes',
    slug: 'books-notes',
    description: 'Academic textbooks, course slide handouts, handwritten lecture notes, and reference manuals.',
    icon: 'book-open',
    subcategories: ['Textbooks', 'Course Notes', 'Lab Manuals', 'Fiction & Literature', 'Competitive Exam Guides'],
    isActive: true,
  },
  {
    name: 'Electronics & Gadgets',
    slug: 'electronics-gadgets',
    description: 'Calculators, laptops, headphones, cables, chargers, and engineering hardware kits.',
    icon: 'laptop',
    subcategories: ['Calculators', 'Laptops & PCs', 'Audio & Headphones', 'Cables & Adapters', 'Arduino & IoT Kits', 'Mobile Accessories'],
    isActive: true,
  },
  {
    name: 'Academic Materials',
    slug: 'academic-materials',
    description: 'Drafting tools, geometry sets, lab coats, architecture supplies, and art equipment.',
    icon: 'pen-tool',
    subcategories: ['Lab Coats', 'Drafting Tools', 'Art Supplies', 'Stationery Bundles'],
    isActive: true,
  },
  {
    name: 'Furniture & Living',
    slug: 'furniture-living',
    description: 'Dorm and hall essentials: study tables, chairs, lamps, shoe racks, and organizers.',
    icon: 'armchair',
    subcategories: ['Study Desks', 'Chairs', 'Table Lamps', 'Storage & Organizers', 'Bedsheets & Curtains'],
    isActive: true,
  },
  {
    name: 'Clothing & Apparel',
    slug: 'clothing-apparel',
    description: 'Formal attire, university blazers, sports kits, and seasonal jackets.',
    icon: 'shirt',
    subcategories: ['Formal Suits & Blazers', 'Casual Wear', 'Winter Jackets', 'Sports Wear'],
    isActive: true,
  },
  {
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    description: 'Badminton rackets, cricket bats, footballs, gym gear, and indoor games.',
    icon: 'activity',
    subcategories: ['Rackets & Bats', 'Balls & Gear', 'Fitness Equipment', 'Board Games'],
    isActive: true,
  },
  {
    name: 'Other Essentials',
    slug: 'other-essentials',
    description: 'Miscellaneous campus utilities, bags, umbrellas, and bicycle accessories.',
    icon: 'package',
    subcategories: ['Backpacks', 'Bicycle & Accessories', 'Umbrellas', 'Miscellaneous'],
    isActive: true,
  },
];

/**
 * Idempotently seed categories in MongoDB
 */
export const seedCategories = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    for (const cat of initialCategories) {
      await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $set: cat },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed] Categories seeded/synchronized successfully.');
  } catch (error) {
    console.error('[Seed Error] Failed to seed categories:', error.message);
  }
};
