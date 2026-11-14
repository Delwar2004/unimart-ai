import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { USER_ROLES, ACCOUNT_STATUS, LISTING_TYPES, PRODUCT_CONDITIONS, PRODUCT_STATUS, MODERATION_STATUS } from '../constants/index.js';

export const seedDemoData = async (forceReset = false) => {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123', salt);

    // 1. Seed Demo Users
    const usersData = [
      {
        name: 'UniMart Admin',
        email: 'admin@bup.edu.bd',
        passwordHash,
        studentId: '24549010000',
        department: 'ICT',
        batch: 'BICE-24',
        phone: '+8801700000000',
        campusLocation: 'Admin Building, Level 4',
        role: USER_ROLES.ADMIN,
        isVerified: true,
        status: ACCOUNT_STATUS.ACTIVE,
      },
      {
        name: 'Student User',
        email: 'student@bup.edu.bd',
        passwordHash,
        studentId: '24549010001',
        department: 'Computer Science & Engineering',
        batch: 'BCSE-23',
        phone: '+8801700000001',
        campusLocation: 'Mirpur Campus Gate 1',
        role: USER_ROLES.STUDENT,
        isVerified: true,
        status: ACCOUNT_STATUS.ACTIVE,
      },
      {
        name: 'Delwar Husen',
        email: 'delwar@bup.edu.bd',
        passwordHash,
        studentId: '24549010076',
        department: 'Information & Communication Tech',
        batch: 'BICE-24',
        phone: '+8801700000076',
        campusLocation: 'BUP Campus, Faculty Building 2',
        role: USER_ROLES.STUDENT,
        isVerified: true,
        status: ACCOUNT_STATUS.ACTIVE,
      },
      {
        name: 'Sadia Rahman',
        email: 'sadia@bup.edu.bd',
        passwordHash,
        studentId: '24549010042',
        department: 'Business Administration (BBA)',
        batch: 'BBA-24',
        phone: '+8801811122334',
        campusLocation: 'FBS Building, 3rd Floor',
        role: USER_ROLES.STUDENT,
        isVerified: true,
        status: ACCOUNT_STATUS.ACTIVE,
      },
      {
        name: 'Tanvir Ahmed',
        email: 'tanvir@bup.edu.bd',
        passwordHash,
        studentId: '24549010099',
        department: 'Electrical, Electronic & Communication',
        batch: 'BEEC-23',
        phone: '+8801922334455',
        campusLocation: 'Hall of Residence / Dorm Gate',
        role: USER_ROLES.STUDENT,
        isVerified: true,
        status: ACCOUNT_STATUS.ACTIVE,
      },
    ];

    const savedUsers = {};
    for (const u of usersData) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create(u);
      }
      savedUsers[u.email] = user;
    }
    console.log('[Seed] Demo users verified / seeded successfully.');

    // 2. Fetch Categories
    const bookCat = await Category.findOne({ slug: 'books-notes' });
    const electronicsCat = await Category.findOne({ slug: 'electronics-gadgets' });
    const academicCat = await Category.findOne({ slug: 'academic-materials' });
    const furnitureCat = await Category.findOne({ slug: 'furniture-living' });
    const clothingCat = await Category.findOne({ slug: 'clothing-apparel' });
    const sportsCat = await Category.findOne({ slug: 'sports-fitness' });
    const otherCat = await Category.findOne({ slug: 'other-essentials' });

    if (!bookCat || !electronicsCat) {
      console.warn('[Seed] Categories not ready yet. Skipping product seeding.');
      return;
    }

    const sellerDelwar = savedUsers['delwar@bup.edu.bd'] || savedUsers['student@bup.edu.bd'];
    const sellerStudent = savedUsers['student@bup.edu.bd'];
    const sellerSadia = savedUsers['sadia@bup.edu.bd'] || sellerDelwar;
    const sellerTanvir = savedUsers['tanvir@bup.edu.bd'] || sellerDelwar;

    const existingProductsCount = await Product.countDocuments();
    if (forceReset || existingProductsCount < 6) {
      if (forceReset) {
        await Product.deleteMany({});
      }

      const realProducts = [
        // 1. Calculator
        {
          title: 'Casio Scientific Calculator & Study Notebook Set',
          description: 'Original Casio scientific calculator with solar + battery dual power. Comes with a pocket study notebook and smooth ballpoint pen. Perfect for mathematics, statistics, and engineering calculations.',
          category: electronicsCat._id,
          subCategory: 'Calculators',
          seller: sellerDelwar._id,
          listingType: LISTING_TYPES.SELL,
          price: 1450,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Mirpur DOHS / Campus Gate 1',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['casio', 'calculator', 'engineering', 'math', 'notebook'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1611125832047-1d7ad1e8e48f?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 2. Morris Mano Digital Logic
        {
          title: 'Digital Logic and Computer Design - M. Morris Mano (Study Guide)',
          description: 'Essential textbook and study guide for CSE/ICT/EEE digital circuits course. High quality print, clean readable pages, includes important exam questions and chapter summaries.',
          category: bookCat._id,
          subCategory: 'Textbooks',
          seller: sellerStudent._id,
          listingType: LISTING_TYPES.SELL,
          price: 380,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.GOOD,
          campusLocation: 'Central Library, Ground Floor',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['dld', 'morris mano', 'textbook', 'ict', 'cse'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 3. Academic Textbooks Collection
        {
          title: 'Academic Textbooks & Reference Manuals Collection (ECE/CSE)',
          description: 'Collection of standard university textbooks covering fundamental circuit theory, algorithms, and engineering mathematics. Hardcover and paperback editions in great condition.',
          category: bookCat._id,
          subCategory: 'Textbooks',
          seller: sellerTanvir._id,
          listingType: LISTING_TYPES.SELL,
          price: 650,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Faculty Building 2 / EE Department',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['books', 'textbooks', 'engineering', 'reference'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 4. Arduino Uno R3
        {
          title: 'Arduino Uno R3 Microcontroller Board for Semester Projects',
          description: 'Original Italian design Arduino Uno R3 with ATmega328P chip, USB interface, and digital/analog I/O pin headers. Tested and fully functional for robotics and IoT projects.',
          category: electronicsCat._id,
          subCategory: 'Arduino & IoT Kits',
          seller: sellerDelwar._id,
          listingType: LISTING_TYPES.EXCHANGE,
          exchangePreferences: 'Looking for Raspberry Pi 3/4 or STM32 / ESP32 development board',
          price: 0,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'ICT Lab 3, 2nd Floor',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['arduino', 'iot', 'robotics', 'microcontroller', 'electronics'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 5. Lab Gloves
        {
          title: 'Box of Medical & Science Lab Nitrile/Latex Gloves (Size L)',
          description: 'Full sealed box of high-durability blue nitrile examination gloves required for chemistry, biology, and materials science laboratory sessions. Powder-free and textured grip.',
          category: academicCat._id,
          subCategory: 'Lab Coats',
          seller: sellerSadia._id,
          listingType: LISTING_TYPES.SELL,
          price: 280,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Cafeteria / Student Lounge',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['gloves', 'lab supplies', 'science', 'chemistry', 'freshman'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 6. Logitech Mouse
        {
          title: 'Wireless Ergonomic Bluetooth Optical Mouse (Matte Black)',
          description: 'Ergonomic high-precision optical mouse with silent click switches and textured scroll wheel. Works smoothly over Bluetooth or 2.4G wireless adapter on Windows and Mac.',
          category: electronicsCat._id,
          subCategory: 'Mobile Accessories',
          seller: sellerDelwar._id,
          listingType: LISTING_TYPES.SELL,
          price: 850,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Mirpur DOHS, Gate 2',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['mouse', 'wireless', 'accessories', 'ergonomic', 'gadgets'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 7. Study Desk & Chair Set
        {
          title: 'Modern Minimalist Study Desk & Ergonomic Office Chair Set',
          description: 'Sturdy wooden desktop computer study desk with lower book storage shelf, accompanied by a comfortable height-adjustable swivel chair. Ideal setup for hostel dorm or apartment.',
          category: (furnitureCat && furnitureCat._id) || academicCat._id,
          subCategory: 'Study Desks',
          seller: sellerSadia._id,
          listingType: LISTING_TYPES.SELL,
          price: 3500,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Female Hall of Residence Gate',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['desk', 'chair', 'furniture', 'dorm', 'study table'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 8. Color Pencil Set
        {
          title: 'Architectural Sketching & Drafting Color Pencil Set (24 Colors)',
          description: 'Complete 24-color artist drawing pencils set for engineering graphics, civil drafting, architectural illustrations, and creative studio coursework.',
          category: academicCat._id,
          subCategory: 'Drafting Tools',
          seller: sellerTanvir._id,
          listingType: LISTING_TYPES.SELL,
          price: 320,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Architecture & Civil Studio, Level 3',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['pencils', 'sketching', 'drafting', 'architecture', 'art'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 9. Yonex Badminton Racket
        {
          title: 'Carbon Fiber Tournament Badminton Racket with Full Cover',
          description: 'Lightweight offensive carbon fiber badminton racket with high-tension strings. Excellent balance and grip. Ready for campus tournaments and sports complex practice.',
          category: (sportsCat && sportsCat._id) || otherCat._id,
          subCategory: 'Rackets & Bats',
          seller: sellerStudent._id,
          listingType: LISTING_TYPES.SELL,
          price: 1250,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.GOOD,
          campusLocation: 'Gymnasium & Sports Complex',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['badminton', 'racket', 'sports', 'fitness', 'campus gym'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 10. USB-C Charger
        {
          title: '65W USB-C Fast Charger & Long Braided Cable (White)',
          description: 'High-speed 65W power delivery charging adapter with durable USB Type-C cable. Rapidly charges laptops, MacBooks, tablets, and smartphones without overheating.',
          category: electronicsCat._id,
          subCategory: 'Cables & Adapters',
          seller: sellerDelwar._id,
          listingType: LISTING_TYPES.SELL,
          price: 1450,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'BUP Campus Plaza',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['charger', 'usb-c', 'fast charger', 'laptop', 'adapter'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 11. Minimalist Study Lamp
        {
          title: 'Matte Black Adjustable Nordic Study Desk Lamp',
          description: 'Minimalist industrial metal desk lamp with directional swivel shade. Delivers soft, non-flickering light designed for long study hours and thesis writing.',
          category: (furnitureCat && furnitureCat._id) || academicCat._id,
          subCategory: 'Table Lamps',
          seller: sellerTanvir._id,
          listingType: LISTING_TYPES.SELL,
          price: 750,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Male Dormitory Block B',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['lamp', 'study lamp', 'nordic', 'dorm', 'furniture'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 12. Free Solved Notes
        {
          title: 'Freshman Course Lecture Notes & Solved Question Bank',
          description: 'Thick handwritten spiral lecture notes and semester exam question bank with solved problems for first-year engineering and science courses. Free giveaway for juniors.',
          category: bookCat._id,
          subCategory: 'Course Notes',
          seller: sellerDelwar._id,
          listingType: LISTING_TYPES.GIVEAWAY,
          price: 0,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.GOOD,
          campusLocation: 'Faculty Building 2 Lobby',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['notes', 'giveaway', 'free', 'solved questions', 'freshman'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 13. Rollerball Pen & Sudoku Grid
        {
          title: 'Uni-ball Vision Needle Rollerball Pen & Engineering Grid Set',
          description: 'Waterproof fade-proof 0.5mm needle-point rollerball pen paired with precision grid sheets and logic puzzle books. Excellent for detailed diagram drawing and assignments.',
          category: academicCat._id,
          subCategory: 'Stationery Bundles',
          seller: sellerStudent._id,
          listingType: LISTING_TYPES.SELL,
          price: 180,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Main Cafeteria',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['pen', 'stationery', 'uni-ball', 'grid', 'drawing'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 14. Match Football
        {
          title: 'All-Weather Match Football (Size 5, Turf & Grass Standard)',
          description: 'High-durability all-weather match football. Reinforced bladder for optimal air retention and true flight trajectory. Suitable for campus tournaments and outdoor turf.',
          category: (sportsCat && sportsCat._id) || otherCat._id,
          subCategory: 'Balls & Gear',
          seller: sellerTanvir._id,
          listingType: LISTING_TYPES.SELL,
          price: 850,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.GOOD,
          campusLocation: 'University Playground / Sports Pavilion',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['football', 'sports', 'turf', 'ball', 'match'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
        // 15. Student Canvas Tote Bag
        {
          title: 'Eco-Friendly Heavy Canvas Student Tote Bag / Book Bag',
          description: 'Durable reinforced beige cotton canvas tote bag with comfortable shoulder straps. Easily holds a 14-inch laptop, heavy spiral notebooks, and daily campus essentials.',
          category: (otherCat && otherCat._id) || academicCat._id,
          subCategory: 'Backpacks',
          seller: sellerSadia._id,
          listingType: LISTING_TYPES.SELL,
          price: 260,
          currency: 'BDT',
          condition: PRODUCT_CONDITIONS.LIKE_NEW,
          campusLocation: 'Female Hall Front Gate',
          status: PRODUCT_STATUS.AVAILABLE,
          moderationStatus: MODERATION_STATUS.APPROVED,
          tags: ['bag', 'tote bag', 'canvas', 'campus', 'books'],
          images: [
            {
              url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
              isThumbnail: true,
            },
          ],
        },
      ];

      await Product.insertMany(realProducts);
      console.log(`[Seed] ${realProducts.length} realistic campus products seeded successfully.`);
    }
  } catch (error) {
    console.error('[Seed Error] Demo data seeding failed:', error.message);
  }
};

