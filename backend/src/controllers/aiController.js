import fs from 'fs';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Wishlist } from '../models/Wishlist.js';
import { Transaction } from '../models/Transaction.js';
import {
  callGenerateDescription,
  callSuggestCategory,
  callInterpretSearchQuery,
  sanitizeSearchInterpretation,
  callAssistant,
  sanitizeSuggestedActions,
  callEstimatePrice,
  callClassifyProductImage,
  AIConfigError,
  AIProviderError,
} from '../services/aiProvider.js';
import {
  PRODUCT_CONDITIONS,
  LISTING_TYPES,
  PRODUCT_STATUS,
  TRANSACTION_STATUS,
} from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Simple in-memory sliding window rate limiter per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10) || 60;
const requestCounts = new Map();

const isRateLimited = (userId, req) => {
  // Production security safeguard: bypass header is strictly ignored in production environments
  if (process.env.NODE_ENV !== 'production' && req?.headers?.['x-bypass-rate-limit'] === 'true') {
    return false;
  }
  const now = Date.now();
  const userHistory = requestCounts.get(userId) || [];
  const validHistory = userHistory.filter((time) => now - time < RATE_LIMIT_WINDOW_MS);

  if (validHistory.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  validHistory.push(now);
  requestCounts.set(userId, validHistory);
  return false;
};

/**
 * POST /api/v1/ai/product-description
 * Generate a student marketplace product description based on attributes
 */
export const generateProductDescription = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || 'anonymous';
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before generating another description.',
      });
    }

    const {
      title,
      condition = 'good',
      listingType = 'sell',
      keyFeatures = '',
      categoryName = '',
      exchangePreferences = '',
    } = req.body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title is required and must be at least 3 characters long.',
      });
    }

    if (title.trim().length > 200) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title cannot exceed 200 characters.',
      });
    }

    if (condition && !Object.values(PRODUCT_CONDITIONS).includes(condition)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid condition. Allowed values: ${Object.values(PRODUCT_CONDITIONS).join(', ')}`,
      });
    }

    if (listingType && !Object.values(LISTING_TYPES).includes(listingType)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid listing type. Allowed values: ${Object.values(LISTING_TYPES).join(', ')}`,
      });
    }

    if (keyFeatures && typeof keyFeatures === 'string' && keyFeatures.trim().length > 500) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Key features note cannot exceed 500 characters.',
      });
    }

    if (exchangePreferences && typeof exchangePreferences === 'string' && exchangePreferences.trim().length > 200) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Exchange preferences cannot exceed 200 characters.',
      });
    }

    const providerOverride = req.headers['x-ai-provider'];

    const generatedText = await callGenerateDescription({
      title: title.trim(),
      condition,
      listingType,
      keyFeatures: keyFeatures?.trim(),
      categoryName: categoryName?.trim(),
      exchangePreferences: exchangePreferences?.trim(),
      providerOverride,
    });

    const words = generatedText.split(/\s+/).filter(Boolean).length;

    return successResponse(res, {
      data: {
        description: generatedText,
        wordCount: words,
        generatedAt: new Date().toISOString(),
        isAiGenerated: true,
      },
      message: 'Product description generated successfully.',
    });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return errorResponse(res, {
        statusCode: err.status || 503,
        message: err.message,
      });
    }
    if (err instanceof AIProviderError) {
      return errorResponse(res, {
        statusCode: err.status || 502,
        message: err.message,
      });
    }

    console.error('Error generating product description:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to generate product description.',
      errors: err.message,
    });
  }
};

/**
 * POST /api/v1/ai/suggest-category
 * Suggest the best matching category from actual database categories
 */
export const suggestCategory = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || 'anonymous';
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before requesting another category suggestion.',
      });
    }

    const { title, description = '' } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title is required and must be at least 3 characters long to suggest a category.',
      });
    }

    if (title.trim().length > 200) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title cannot exceed 200 characters.',
      });
    }

    if (description && typeof description === 'string' && description.trim().length > 3000) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Description cannot exceed 3000 characters.',
      });
    }

    // Retrieve active categories from database
    const candidateCategories = await Category.find({ isActive: true })
      .select('_id name slug description subcategories')
      .lean();

    if (!candidateCategories || candidateCategories.length === 0) {
      return successResponse(res, {
        data: {
          categoryId: null,
          categoryName: null,
          confidence: 0,
          reason: 'No categories currently available in the database.',
        },
        message: 'No categories available for suggestion.',
      });
    }

    const providerOverride = req.headers['x-ai-provider'];

    const suggestion = await callSuggestCategory({
      title: title.trim(),
      description: description?.trim() || '',
      candidateCategories,
      providerOverride,
    });

    return successResponse(res, {
      data: {
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        generatedAt: new Date().toISOString(),
      },
      message: 'Category suggestion generated successfully.',
    });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return errorResponse(res, {
        statusCode: err.status || 503,
        message: err.message,
      });
    }
    if (err instanceof AIProviderError) {
      return errorResponse(res, {
        statusCode: err.status || 502,
        message: err.message,
      });
    }

    console.error('Error suggesting product category:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to suggest product category.',
      errors: err.message,
    });
  }
};

/**
 * POST /api/v1/ai/search-query
 * Interpret natural-language search query into validated filters and optionally execute search
 */
export const interpretSearchQuery = async (req, res, next) => {
  try {
    const userId = req.user?._id?.toString() || 'anonymous';
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before submitting another query.',
      });
    }

    const { query, execute = true, page = 1, limit = 12 } = req.body;

    // Validation
    if (!query || typeof query !== 'string' || !query.trim()) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Search query is required and cannot be empty.',
      });
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 300) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Search query cannot exceed 300 characters.',
      });
    }

    // Fetch candidate active categories from MongoDB
    const candidateCategories = await Category.find({}).lean();
    const userCampus = req.user?.campusLocation || '';
    const providerOverride = req.headers['x-ai-provider'];

    let rawInterpretation;
    try {
      rawInterpretation = await callInterpretSearchQuery({
        query: trimmedQuery,
        candidateCategories,
        userCampus,
        providerOverride,
      });
    } catch (err) {
      if (err instanceof AIConfigError) {
        return errorResponse(res, {
          statusCode: err.status || 503,
          message: err.message,
        });
      }
      if (err instanceof AIProviderError) {
        return errorResponse(res, {
          statusCode: err.status || 502,
          message: err.message,
        });
      }
      throw err;
    }

    // Treat AI output strictly as untrusted data: validate and sanitize every single property
    const interpretation = sanitizeSearchInterpretation(rawInterpretation, candidateCategories);

    const appliedFilters = {
      q: interpretation.q || undefined,
      category: interpretation.category || undefined,
      minPrice: interpretation.minPrice !== null ? interpretation.minPrice : undefined,
      maxPrice: interpretation.maxPrice !== null ? interpretation.maxPrice : undefined,
      condition: interpretation.condition || undefined,
      listingType: interpretation.listingType || undefined,
      campusLocation: interpretation.campusLocation || undefined,
      sort: interpretation.sort,
    };

    // If caller requests interpretation only
    if (!execute) {
      return successResponse(res, {
        statusCode: 200,
        message: 'Search query interpreted successfully.',
        data: {
          originalQuery: trimmedQuery,
          interpretation,
          appliedFilters,
        },
      });
    }

    // Execute search reusing existing product query semantics and visibility rules
    const sanitizedPage = Math.max(1, parseInt(page, 10) || 1);
    const sanitizedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    const mongoQuery = {
      status: PRODUCT_STATUS.AVAILABLE, // strictly available listings only
    };

    let isTextSearch = false;
    if (interpretation.q) {
      mongoQuery.$text = { $search: interpretation.q };
      isTextSearch = true;
    }

    if (interpretation.category) {
      mongoQuery.category = interpretation.category;
    }

    if (interpretation.minPrice !== null || interpretation.maxPrice !== null) {
      const priceFilter = {};
      if (interpretation.minPrice !== null) priceFilter.$gte = interpretation.minPrice;
      if (interpretation.maxPrice !== null) priceFilter.$lte = interpretation.maxPrice;
      mongoQuery.price = priceFilter;
    }

    if (interpretation.condition) {
      mongoQuery.condition = interpretation.condition;
    }

    if (interpretation.listingType) {
      mongoQuery.listingType = interpretation.listingType;
    }

    if (interpretation.campusLocation) {
      const escaped = interpretation.campusLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      mongoQuery.campusLocation = { $regex: new RegExp(escaped, 'i') };
    }

    // Safe sorting mapping
    let sortOption = {};
    if (isTextSearch && interpretation.sort === 'relevance') {
      sortOption = { score: { $meta: 'textScore' } };
    } else {
      switch (interpretation.sort) {
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'price_asc':
          sortOption = { price: 1, createdAt: -1 };
          break;
        case 'price_desc':
          sortOption = { price: -1, createdAt: -1 };
          break;
        case 'popular':
          sortOption = { viewsCount: -1, createdAt: -1 };
          break;
        case 'newest':
        default:
          sortOption = { createdAt: -1 };
          break;
      }
    }

    const total = await Product.countDocuments(mongoQuery);
    const totalPages = Math.ceil(total / sanitizedLimit) || 1;

    let queryBuilder = Product.find(mongoQuery);
    if (isTextSearch && interpretation.sort === 'relevance') {
      queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
    }

    const products = await queryBuilder
      .populate('category', 'name slug icon')
      .populate('seller', 'name avatarUrl campusLocation reputation')
      .sort(sortOption)
      .skip(skip)
      .limit(sanitizedLimit)
      .lean();

    return successResponse(res, {
      statusCode: 200,
      message: 'Natural-language search executed successfully.',
      data: {
        originalQuery: trimmedQuery,
        interpretation,
        appliedFilters,
        products,
        pagination: {
          page: sanitizedPage,
          limit: sanitizedLimit,
          totalItems: total,
          totalPages,
          hasNextPage: sanitizedPage < totalPages,
          hasPreviousPage: sanitizedPage > 1,
        },
      },
    });
  } catch (err) {
    console.error('Error executing natural language search:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to process natural-language search query.',
      errors: err.message,
    });
  }
};

/**
 * GET /api/v1/ai/recommendations
 * Personalized recommendations based on student wishlist, transaction history, and campus
 */
export const getPersonalizedRecommendations = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Authentication required for personalized recommendations.',
      });
    }

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

    // Signal Gathering:
    // 1. Wishlist categories
    const wishlistItems = await Wishlist.find({ user: user._id })
      .populate({
        path: 'product',
        select: 'category status',
      })
      .lean();

    const wishlistCategoryIds = wishlistItems
      .filter((w) => w.product && w.product.category)
      .map((w) => w.product.category.toString());

    // 2. Buyer completed transactions categories
    const pastTransactions = await Transaction.find({
      buyer: user._id,
      status: TRANSACTION_STATUS.COMPLETED,
    })
      .populate({
        path: 'product',
        select: 'category',
      })
      .limit(20)
      .lean();

    const transactionCategoryIds = pastTransactions
      .filter((t) => t.product && t.product.category)
      .map((t) => t.product.category.toString());

    // 3. User campus location
    const userCampus = user.campusLocation?.trim() || '';

    // Candidate query rules:
    // Strictly exclude the user's own listings and only available products
    const baseQuery = {
      seller: { $ne: user._id },
      status: PRODUCT_STATUS.AVAILABLE,
    };

    const recommendedList = [];
    const seenProductIds = new Set();

    const addProduct = (prod, reason, score) => {
      const idStr = prod._id.toString();
      if (!seenProductIds.has(idStr)) {
        seenProductIds.add(idStr);
        recommendedList.push({
          ...prod,
          recommendationReason: reason,
          recommendationScore: score,
        });
      }
    };

    // Stage 1: Products matching wishlist categories
    if (wishlistCategoryIds.length > 0 && recommendedList.length < limit) {
      const wishlistMatches = await Product.find({
        ...baseQuery,
        category: { $in: wishlistCategoryIds },
      })
        .populate('category', 'name slug icon')
        .populate('seller', 'name avatarUrl campusLocation reputation')
        .sort({ viewsCount: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      for (const prod of wishlistMatches) {
        addProduct(prod, 'Matches categories in your wishlist', 0.95);
      }
    }

    // Stage 2: Products matching past transactions categories
    if (transactionCategoryIds.length > 0 && recommendedList.length < limit) {
      const txMatches = await Product.find({
        ...baseQuery,
        category: { $in: transactionCategoryIds },
        _id: { $nin: Array.from(seenProductIds) },
      })
        .populate('category', 'name slug icon')
        .populate('seller', 'name avatarUrl campusLocation reputation')
        .sort({ viewsCount: -1, createdAt: -1 })
        .limit(limit - recommendedList.length)
        .lean();

      for (const prod of txMatches) {
        addProduct(prod, 'Based on your past transactions', 0.85);
      }
    }

    // Stage 3: Products available on student's campus
    if (userCampus && recommendedList.length < limit) {
      const escaped = userCampus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const campusMatches = await Product.find({
        ...baseQuery,
        campusLocation: { $regex: new RegExp(escaped, 'i') },
        _id: { $nin: Array.from(seenProductIds) },
      })
        .populate('category', 'name slug icon')
        .populate('seller', 'name avatarUrl campusLocation reputation')
        .sort({ viewsCount: -1, createdAt: -1 })
        .limit(limit - recommendedList.length)
        .lean();

      for (const prod of campusMatches) {
        addProduct(prod, `Popular on your campus (${userCampus})`, 0.75);
      }
    }

    // Stage 4: Popular / Trending Fallback across university
    if (recommendedList.length < limit) {
      const fallbackMatches = await Product.find({
        ...baseQuery,
        _id: { $nin: Array.from(seenProductIds) },
      })
        .populate('category', 'name slug icon')
        .populate('seller', 'name avatarUrl campusLocation reputation')
        .sort({ viewsCount: -1, averageRating: -1, createdAt: -1 })
        .limit(limit - recommendedList.length)
        .lean();

      for (const prod of fallbackMatches) {
        const reason = prod.viewsCount > 5 ? 'Popular among students' : 'New arrival on campus';
        addProduct(prod, reason, 0.6);
      }
    }

    return successResponse(res, {
      statusCode: 200,
      message: 'Personalized recommendations retrieved successfully.',
      data: {
        recommendations: recommendedList.slice(0, limit),
        total: recommendedList.length,
        signalsUsed: {
          wishlistCategoryCount: wishlistCategoryIds.length,
          transactionCategoryCount: transactionCategoryIds.length,
          userCampus: Boolean(userCampus),
        },
      },
    });
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to retrieve personalized recommendations.',
      errors: err.message,
    });
  }
};

/**
 * POST /api/v1/ai/assistant
 * Dedicated AI Marketplace Assistant for natural language campus commerce guidance
 */
export const askAssistant = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Authentication required to use AI assistant.',
      });
    }

    if (!user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before using the AI marketplace assistant.',
      });
    }

    const userId = user._id.toString();
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before sending another message.',
      });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Message cannot be empty.',
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 2000) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Message cannot exceed 2000 characters.',
      });
    }

    // Contextual summary for the student's own records (safe aggregated counts only)
    const [activeListingCount, activeTransactionCount] = await Promise.all([
      Product.countDocuments({ seller: user._id, status: PRODUCT_STATUS.AVAILABLE }),
      Transaction.countDocuments({
        $or: [{ buyer: user._id }, { seller: user._id }],
        status: { $in: ['PENDING', 'CONFIRMED_BY_BUYER', 'CONFIRMED_BY_SELLER'] },
      }),
    ]);

    const userContext = {
      userId,
      campusLocation: user.campusLocation || '',
      department: user.department || '',
      activeListingCount,
      activeTransactionCount,
    };

    const providerOverride = req.headers['x-ai-provider'];

    let assistantResult;
    try {
      assistantResult = await callAssistant({
        message: trimmedMessage,
        userContext,
        providerOverride,
      });
    } catch (err) {
      if (err instanceof AIConfigError) {
        return errorResponse(res, {
          statusCode: err.status || 503,
          message: err.message,
        });
      }
      if (err instanceof AIProviderError) {
        return errorResponse(res, {
          statusCode: err.status || 502,
          message: err.message,
        });
      }
      throw err;
    }

    const sanitizedActions = sanitizeSuggestedActions(assistantResult.suggestedActions);

    return successResponse(res, {
      statusCode: 200,
      message: 'Assistant response generated successfully.',
      data: {
        answer: assistantResult.answer,
        reply: assistantResult.answer,
        suggestedActions: sanitizedActions,
        provider: assistantResult.provider || 'mock',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error generating assistant response:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to process assistant request.',
      errors: err.message,
    });
  }
};

/**
 * POST /api/v1/ai/estimate-price
 * Estimate listing price based on attributes, historical marketplace data, or fallback benchmarks
 */
export const estimatePrice = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Authentication required to access price estimation.',
      });
    }

    if (!user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before using AI price estimation.',
      });
    }

    const userId = user._id.toString();
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before requesting another price estimate.',
      });
    }

    const {
      title,
      categoryId,
      condition,
      listingType = 'sell',
      brand = '',
      model = '',
      usageDuration = '',
      description = '',
    } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title is required and must be at least 3 characters long.',
      });
    }

    if (title.trim().length > 200) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Product title cannot exceed 200 characters.',
      });
    }

    // Validate categoryId
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Valid category ID is required.',
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Category not found in database.',
      });
    }

    // Validate condition
    if (!condition || !Object.values(PRODUCT_CONDITIONS).includes(condition)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid condition. Allowed values: ${Object.values(PRODUCT_CONDITIONS).join(', ')}`,
      });
    }

    // Validate listingType
    if (listingType && !Object.values(LISTING_TYPES).includes(listingType)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid listing type. Allowed values: ${Object.values(LISTING_TYPES).join(', ')}`,
      });
    }

    // Optional field length limits
    if (brand && typeof brand === 'string' && brand.length > 100) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Brand cannot exceed 100 characters.',
      });
    }
    if (model && typeof model === 'string' && model.length > 100) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Model cannot exceed 100 characters.',
      });
    }
    if (usageDuration && typeof usageDuration === 'string' && usageDuration.length > 100) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Usage duration cannot exceed 100 characters.',
      });
    }
    if (description && typeof description === 'string' && description.length > 3000) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Description cannot exceed 3000 characters.',
      });
    }

    // Free Giveaway listings must have price = 0
    if (listingType === LISTING_TYPES.GIVEAWAY) {
      return successResponse(res, {
        statusCode: 200,
        message: 'Price estimate generated successfully.',
        data: {
          suggestedPrice: 0,
          minimumSuggestedPrice: 0,
          maximumSuggestedPrice: 0,
          currency: 'BDT',
          confidence: 'high',
          estimationMethod: 'giveaway_policy',
          reasoning: 'Free student giveaway listings must have an asking price of 0 BDT according to university community policy.',
          comparablesCount: 0,
          warnings: ['Giveaway items are intended for free student donation and cannot have a positive asking price.'],
          provider: 'mock',
        },
      });
    }

    // Gather historical comparables from MongoDB (strictly excluding user's own listings)
    // 1. Completed transactions for products in this category
    const completedTransactions = await Transaction.find({
      status: TRANSACTION_STATUS.COMPLETED,
      seller: { $ne: user._id },
      agreedPrice: { $gt: 0 },
    })
      .populate({
        path: 'product',
        match: { category: category._id },
        select: 'title category condition price',
      })
      .limit(30);

    const txComparables = completedTransactions
      .filter((t) => t.product && t.product.category)
      .map((t) => ({
        price: t.agreedPrice,
        condition: t.product.condition || 'good',
        isTransaction: true,
        title: t.product.title || '',
      }));

    // 2. Active or sold listings in this category (excluding seller's own listings)
    const productListings = await Product.find({
      category: category._id,
      seller: { $ne: user._id },
      price: { $gt: 0 },
      listingType: LISTING_TYPES.SELL,
      status: { $in: [PRODUCT_STATUS.AVAILABLE, PRODUCT_STATUS.RESERVED, PRODUCT_STATUS.SOLD] },
    })
      .select('title category condition price')
      .limit(30);

    const listingComparables = productListings.map((p) => ({
      price: p.price,
      condition: p.condition || 'good',
      isTransaction: false,
      title: p.title || '',
    }));

    const allComparables = [...txComparables, ...listingComparables];

    // Filter by keyword relevance if applicable
    const titleTokens = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'used'].includes(w));

    const keywordComparables = allComparables.filter((c) =>
      titleTokens.some((tok) => c.title.toLowerCase().includes(tok))
    );

    // Prefer keyword-matching comparables if >= 2 available, otherwise use category comparables
    const finalComparables = keywordComparables.length >= 2 ? keywordComparables : allComparables;

    const providerOverride = req.headers['x-ai-provider'];

    const estimateResult = await callEstimatePrice({
      title: title.trim(),
      category: { _id: category._id, name: category.name },
      condition,
      listingType,
      brand: brand?.trim(),
      model: model?.trim(),
      usageDuration: usageDuration?.trim(),
      description: description?.trim(),
      comparables: finalComparables,
      providerOverride,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Price estimate generated successfully.',
      data: estimateResult,
    });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return errorResponse(res, {
        statusCode: err.status || 503,
        message: err.message,
      });
    }
    if (err instanceof AIProviderError) {
      return errorResponse(res, {
        statusCode: err.status || 502,
        message: err.message,
      });
    }
    console.error('Error in estimatePrice:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to estimate product price.',
      errors: err.message,
    });
  }
};

/**
 * Validate image buffer magic bytes against allowed binary signatures (JPEG, PNG, GIF, WEBP)
 */
export const isValidImageBuffer = (buffer) => {
  if (!buffer || buffer.length < 8) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return true;
  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  )
    return true;
  // WEBP: RIFF at 0..3 and WEBP at 8..11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return true;

  return false;
};

/**
 * POST /api/v1/ai/classify-product-image
 * Classify product image and suggest category, visible attributes, and confidence
 */
export const classifyProductImage = async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Authentication required for image classification.',
      });
    }

    if (!user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before using AI image classification.',
      });
    }

    const userId = user._id.toString();
    if (isRateLimited(userId, req)) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'AI request limit reached. Please wait a minute before analyzing another image.',
      });
    }

    if (!req.file) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide an image file to classify.',
      });
    }

    // Retrieve active categories from DB
    const activeCategories = await Category.find({ isActive: true });
    if (!activeCategories || activeCategories.length === 0) {
      return errorResponse(res, {
        statusCode: 500,
        message: 'No active categories found in database to classify against.',
      });
    }

    // Read buffer for provider analysis
    let imageBuffer;
    if (req.file.buffer) {
      imageBuffer = req.file.buffer;
    } else if (tempPath && fs.existsSync(tempPath)) {
      imageBuffer = fs.readFileSync(tempPath);
    } else {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Failed to read uploaded image data.',
      });
    }

    // Binary file header validation (prevents renamed non-image file injection)
    if (!isValidImageBuffer(imageBuffer)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid image content. File data does not match a supported image format.',
      });
    }

    const providerOverride = req.headers['x-ai-provider'];

    const classificationResult = await callClassifyProductImage({
      imageBuffer,
      mimeType: req.file.mimetype,
      originalFilename: req.file.originalname,
      activeCategories,
      providerOverride,
    });

    // Ensure no filesystem paths or private keys leak in data
    return successResponse(res, {
      statusCode: 200,
      message: 'Product image classified successfully.',
      data: {
        suggestedCategoryId: classificationResult.suggestedCategoryId,
        suggestedCategoryName: classificationResult.suggestedCategoryName,
        visibleProductType: classificationResult.visibleProductType,
        observableAttributes: classificationResult.observableAttributes,
        suggestedBrand: classificationResult.suggestedBrand,
        confidence: classificationResult.confidence,
        confidenceLevel: classificationResult.confidenceLevel,
        warnings: classificationResult.warnings,
        alternativeCategories: classificationResult.alternativeCategories,
        provider: classificationResult.provider || 'mock',
      },
    });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return errorResponse(res, {
        statusCode: err.status || 503,
        message: err.message,
      });
    }
    if (err instanceof AIProviderError) {
      return errorResponse(res, {
        statusCode: err.status || 502,
        message: err.message,
      });
    }
    console.error('Error in classifyProductImage:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to classify product image.',
      errors: err.message,
    });
  } finally {
    // Guaranteed cleanup of temporary upload file
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Safe silence on cleanup
      }
    }
  }
};
