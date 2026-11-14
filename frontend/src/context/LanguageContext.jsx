import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  en: {
    // Navigation
    browse_items: 'Browse Items',
    wanted_items: 'Wanted',
    sell_give: '+ Sell / Give',
    my_listings: 'My Listings',
    wishlist: 'Wishlist',
    requests: 'Requests',
    offers: 'Offers',
    transactions: 'Transactions',
    notifications: 'Notifications',
    messages: 'Messages',
    profile: 'Profile',
    admin_moderation: 'Moderation',
    admin_analytics: 'Analytics',
    sign_in: 'Sign In',
    register: 'Register',
    logout: 'Logout',
    dashboard: 'Dashboard',
    theme_dark: 'Dark Mode',
    theme_light: 'Light Mode',

    // Hero Section
    hero_badge: 'Official BUP Student Community Marketplace',
    hero_title_1: 'Campus',
    hero_title_2: 'Marketplace',
    hero_sub: 'Discover quality pre-owned textbooks, electronics, lab gear, and dorm essentials with verified university peers.',
    list_item_btn: '+ List an Item',
    explore_items_btn: 'Explore Listings',
    stat_verified: 'Verified Students',
    stat_safe: 'Safe Campus Trade',
    stat_fee: '0% Platform Fee',
    stat_fast: 'Instant Pickup',

    // Search Section
    standard_search: 'Standard Search',
    ai_search: 'AI Natural Language Search',
    ai_badge: 'Gemini AI',
    search_placeholder_standard: 'Search textbooks, scientific calculators, dorm essentials by keyword...',
    search_placeholder_ai: "Try: 'Calculus 9th edition under 500 BDT in good condition' or 'lab coat for ICT'...",
    search_btn: 'Search',
    searching: 'Searching...',
    reset_filters: 'Reset Filters',

    // Filters
    filters_heading: 'Filter Marketplace',
    category: 'Category',
    all_categories: 'All Categories',
    subcategory: 'Subcategory',
    all_subcategories: 'All Subcategories',
    condition: 'Condition',
    all_conditions: 'All Conditions',
    condition_new: 'Brand New',
    condition_like_new: 'Like New',
    condition_good: 'Good',
    condition_fair: 'Fair',
    listing_type: 'Listing Type',
    all_types: 'All Types',
    type_sell: 'For Sale',
    type_exchange: 'Exchange',
    type_giveaway: 'Free / Giveaway',
    campus_spot: 'Campus Spot',
    all_spots: 'All Campus Spots',
    sort_by: 'Sort By',
    sort_newest: 'Newest First',
    sort_price_low: 'Price: Low to High',
    sort_price_high: 'Price: High to Low',
    sort_popular: 'Most Popular',
    price_range: 'Price Range (BDT ৳)',
    min_price: 'Min ৳',
    max_price: 'Max ৳',
    clear: 'Clear',
    results_found: 'items found',

    // Product Cards
    view_details: 'View Details',
    listed_by: 'Listed by',
    verified_student: 'Verified Student',
    free_badge: 'FREE',
    exchange_badge: 'EXCHANGE',
    bdt_currency: '৳',
    bdt_suffix: 'BDT',

    // Empty State
    no_products_title: 'No Campus Listings Found',
    no_products_sub: "We couldn't find any items matching your active search or filters. Try adjusting your query or be the first student to list one!",
    clear_all_filters: 'Clear All Filters',
    post_item_btn: '+ Post an Item',
    explore_all: 'Explore All Items',

    // Auth & Forms
    welcome_back: 'Welcome Back',
    sign_in_sub: 'Sign in with your university student email',
    email_label: 'University Email',
    password_label: 'Password',
    forgot_password: 'Forgot Password?',
    register_title: 'Create Student Account',
    register_sub: 'Exclusive to verified university students & faculty',

    // AI Assistant
    ai_assistant_title: 'UniMart AI Assistant',
    ai_assistant_sub: 'Intelligent campus guide, item finder & price helper',
    ask_ai: 'Ask AI Assistant',
    ai_placeholder: 'Ask about course books, reasonable prices, or find items...',
    send: 'Send',

    // Footer
    footer_text: 'UniMart AI © 2026 • Connected BUP Student Community • Department of ICT',
    footer_tagline: 'Empowering smart, sustainable student-to-student campus commerce.',
  },
  bn: {
    // Navigation
    browse_items: 'পণ্য খুঁজুন',
    wanted_items: 'প্রয়োজনীয় পণ্য',
    sell_give: '+ পণ্য বিক্রি / দান',
    my_listings: 'আমার লিস্টিং',
    wishlist: 'পছন্দের তালিকা',
    requests: 'অনুরোধ',
    offers: 'প্রস্তাব',
    transactions: 'লেনদেন',
    notifications: 'বিজ্ঞপ্তি',
    messages: 'মেসেজ',
    profile: 'প্রোফাইল',
    admin_moderation: 'মডারেশন',
    admin_analytics: 'অ্যানালিটিক্স',
    sign_in: 'সাইন ইন',
    register: 'রেজিস্ট্রেশন',
    logout: 'লগআউট',
    dashboard: 'ড্যাশবোর্ড',
    theme_dark: 'ডার্ক মোড',
    theme_light: 'লাইট মোড',

    // Hero Section
    hero_badge: 'অফিসিয়াল বিইউপি শিক্ষার্থী কমিউনিটি মার্কেটপ্লেস',
    hero_title_1: 'ক্যাম্পাস',
    hero_title_2: 'মার্কেটপ্লেস',
    hero_sub: 'বিশ্ববিদ্যালয়ের সহপাঠীদের সাথে ব্যবহৃত পাঠ্যবই, ইলেকট্রনিক্স, ল্যাব সামগ্রী ও প্রয়োজনীয় পণ্য নিরাপদে কেনাবেচা বা বিনিময় করুন।',
    list_item_btn: '+ পণ্য যোগ করুন',
    explore_items_btn: 'পণ্যসমূহ দেখুন',
    stat_verified: 'যাচাইকৃত শিক্ষার্থী',
    stat_safe: 'নিরাপদ ক্যাম্পাস ট্রেড',
    stat_fee: '০% প্ল্যাটফর্ম ফি',
    stat_fast: 'দ্রুত হ্যান্ড-টু-হ্যান্ড',

    // Search Section
    standard_search: 'সাধারণ অনুসন্ধান',
    ai_search: 'এআই ন্যাচারাল ল্যাঙ্গুয়েজ সার্চ',
    ai_badge: 'জেমিনাই এআই',
    search_placeholder_standard: 'পাঠ্যবই, ক্যালকুলেটর, সাইকেল বা হোস্টেল সামগ্রী খুঁজুন...',
    search_placeholder_ai: "উদাহরণ: '৫০০ টাকার মধ্যে ভালো অবস্থার ক্যালকুলাস বই' অথবা 'সিএসই ল্যাব অ্যাপ্রন'...",
    search_btn: 'অনুসন্ধান',
    searching: 'অনুসন্ধান চলছে...',
    reset_filters: 'ফিল্টার মুছুন',

    // Filters
    filters_heading: 'ফিল্টার অপশন',
    category: 'ক্যাটাগরি',
    all_categories: 'সব ক্যাটাগরি',
    subcategory: 'সাবক্যাটাগরি',
    all_subcategories: 'সব সাবক্যাটাগরি',
    condition: 'পণ্যের অবস্থা',
    all_conditions: 'সব অবস্থা',
    condition_new: 'একদম নতুন',
    condition_like_new: 'নতুনের মতো',
    condition_good: 'ভালো অবস্থা',
    condition_fair: 'ব্যবহারযোগ্য',
    listing_type: 'লিস্টিং ধরণ',
    all_types: 'সব ধরণ',
    type_sell: 'বিক্রয়ের জন্য',
    type_exchange: 'বিনিময়',
    type_giveaway: 'বিনামূল্যে / উপহার',
    campus_spot: 'ক্যাম্পাস স্পট',
    all_spots: 'সব স্পট',
    sort_by: 'সাজান',
    sort_newest: 'সর্বশেষ প্রকাশিত',
    sort_price_low: 'দাম: কম থেকে বেশি',
    sort_price_high: 'দাম: বেশি থেকে কম',
    sort_popular: 'সবচেয়ে জনপ্রিয়',
    price_range: 'মূল্য পরিসীমা (৳ BDT)',
    min_price: 'সর্বনিম্ন ৳',
    max_price: 'সর্বোচ্চ ৳',
    clear: 'মুছুন',
    results_found: 'টি পণ্য পাওয়া গেছে',

    // Product Cards
    view_details: 'বিস্তারিত দেখুন',
    listed_by: 'বিজ্ঞাপনদাতা',
    verified_student: 'যাচাইকৃত শিক্ষার্থী',
    free_badge: 'ফ্রি',
    exchange_badge: 'বিনিময়',
    bdt_currency: '৳',
    bdt_suffix: 'টাকা',

    // Empty State
    no_products_title: 'কোনো পণ্য খুঁজে পাওয়া যায়নি',
    no_products_sub: 'আপনার নির্বাচিত ফিল্টার বা কীওয়ার্ডের সাথে কোনো লিস্টিং মেলেনি। ফিল্টার রিসেট করুন অথবা আপনিই প্রথম লিস্টিং যোগ করুন!',
    clear_all_filters: 'সব ফিল্টার মুছুন',
    post_item_btn: '+ নতুন পণ্য যোগ করুন',
    explore_all: 'সব পণ্য দেখুন',

    // Auth & Forms
    welcome_back: 'স্বাগতম',
    sign_in_sub: 'আপনার প্রাতিষ্ঠানিক ইমেইল দিয়ে সাইন ইন করুন',
    email_label: 'প্রাতিষ্ঠানিক ইমেইল',
    password_label: 'পাসওয়ার্ড',
    forgot_password: 'পাসওয়ার্ড ভুলে গেছেন?',
    register_title: 'শিক্ষার্থী অ্যাকাউন্ট তৈরি করুন',
    register_sub: 'শুধুমাত্র বিইউপি ও বিশ্ববিদ্যালয়ের শিক্ষার্থীদের জন্য',

    // AI Assistant
    ai_assistant_title: 'ইউনিমর্ট এআই সহকারী',
    ai_assistant_sub: 'স্মার্ট ক্যাম্পাস গাইড, পণ্য অনুসন্ধান ও দরদাম পরামর্শক',
    ask_ai: 'এআই সহকারীকে জিজ্ঞাসা করুন',
    ai_placeholder: 'বইয়ের দাম বা যেকোনো ক্যাম্পাস আইটেম সম্পর্কে জানতে চান...',
    send: 'পাঠান',

    // Footer
    footer_text: 'ইউনিমর্ট এআই © ২০২৬ • সংযুক্ত বিইউপি শিক্ষার্থী কমিউনিটি • আইসিটি বিভাগ',
    footer_tagline: 'ক্যাম্পাসে শিক্ষার্থীদের জন্য পরিবেশবান্ধব ও নির্ভরযোগ্য কেনাবেচার প্ল্যাটফর্ম।',
  },
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem('unimart_lang');
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('unimart_lang', language);
      document.documentElement.lang = language;
    } catch (e) {
      console.warn('Unable to persist language to localStorage:', e);
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  const t = (key, fallback = '') => {
    return translations[language]?.[key] || translations['en']?.[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, isBangla: language === 'bn', toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

