import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import {
  LISTING_TYPES,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  MODERATION_STATUS,
} from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { notifyWishlistOnStatusChange } from '../services/notificationService.js';

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product listing with optional image uploads
 * @access  Private (Verified students only)
 */
export const createProduct = async (req, res, next) => {
  try {
    const user = req.user;

    // Check student verification status
    if (!user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before you can list items on the marketplace.',
      });
    }

    const {
      title,
      description,
      category,
      subCategory,
      listingType = LISTING_TYPES.SELL,
      price = 0,
      currency = 'BDT',
      condition = PRODUCT_CONDITIONS.GOOD,
      campusLocation,
      exchangePreferences,
      tags,
    } = req.body;

    // 1. Required field validations
    if (!title || !description || !category || !campusLocation) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide all required fields (title, description, category, campusLocation).',
      });
    }

    // 2. Validate listingType enum
    if (!Object.values(LISTING_TYPES).includes(listingType)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid listing type. Allowed: ${Object.values(LISTING_TYPES).join(', ')}`,
      });
    }

    // 3. Validate condition enum
    if (!Object.values(PRODUCT_CONDITIONS).includes(condition)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid condition. Allowed: ${Object.values(PRODUCT_CONDITIONS).join(', ')}`,
      });
    }

    // 4. Validate category existence
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid category identifier format.',
      });
    }
    const catExists = await Category.findById(category);
    if (!catExists) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'The selected category does not exist.',
      });
    }

    // 5. Listing type & price business logic
    const numPrice = Number(price);
    if (listingType === LISTING_TYPES.SELL) {
      if (isNaN(numPrice) || numPrice <= 0) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Price must be greater than zero for items listed for sale.',
        });
      }
    }

    const finalPrice = listingType === LISTING_TYPES.GIVEAWAY ? 0 : numPrice;

    // 6. Process uploaded images (if any)
    const images = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file, index) => {
        images.push({
          url: `/uploads/products/${file.filename}`,
          publicId: file.filename,
          isThumbnail: index === 0, // First image is default thumbnail
        });
      });
    }

    // Process tags
    let processedTags = [];
    if (tags) {
      if (Array.isArray(tags)) {
        processedTags = tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof tags === 'string') {
        processedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // 7. Create product
    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      category: catExists._id,
      subCategory: subCategory ? subCategory.trim() : '',
      seller: user._id, // Strictly derived from JWT
      listingType,
      price: finalPrice,
      currency: currency.trim(),
      condition,
      images,
      campusLocation: campusLocation.trim(),
      status: PRODUCT_STATUS.AVAILABLE,
      exchangePreferences: exchangePreferences ? exchangePreferences.trim() : '',
      tags: processedTags,
      moderationStatus: MODERATION_STATUS.PENDING,
      viewsCount: 0,
    });

    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug icon')
      .populate('seller', 'name avatarUrl department batch campusLocation reputation');

    return successResponse(res, {
      statusCode: 201,
      message: 'Product listed successfully!',
      data: populatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/products
 * @desc    Get paginated, filtered, searched and sorted products
 * @access  Public
 */
export const getProducts = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return successResponse(res, {
        statusCode: 200,
        message: 'Products loaded.',
        data: {
          products: [],
          pagination: {
            page: 1,
            limit: 12,
            totalItems: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      });
    }

    const {
      q,
      search,
      category,
      subCategory,
      minPrice,
      maxPrice,
      condition,
      campusLocation,
      listingType,
      sort = 'newest',
      seller,
    } = req.query;

    // 1. Pagination validation
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const query = {};

    // 2. Status & Ownership scope
    if (seller) {
      if (!mongoose.Types.ObjectId.isValid(seller)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid seller ID format.' });
      }
      query.seller = seller;
      // When a seller views their own listings, include reserved and sold unless inactive
      query.status = { $ne: PRODUCT_STATUS.INACTIVE };
    } else {
      // Normal public marketplace discovery strictly shows available products
      query.status = PRODUCT_STATUS.AVAILABLE;
    }

    // 3. Keyword Search (Unified: checks query param `q` or `search` with resilient regex)
    const searchTerm = (q || search || '').trim();
    let isTextSearch = false;
    if (searchTerm) {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // If query ends with 's' and length > 3, match both singular and plural (e.g. books -> book | books)
      const pattern = (escaped.length > 3 && escaped.toLowerCase().endsWith('s'))
        ? `(${escaped}|${escaped.slice(0, -1)})`
        : escaped;

      query.$or = [
        { title: { $regex: new RegExp(pattern, 'i') } },
        { description: { $regex: new RegExp(pattern, 'i') } },
        { tags: { $regex: new RegExp(pattern, 'i') } },
        { exchangePreferences: { $regex: new RegExp(pattern, 'i') } },
      ];
    }

    // 4. Category and Subcategory Filter
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid category identifier format.' });
      }
      query.category = category;
    }

    if (subCategory && typeof subCategory === 'string' && subCategory.trim()) {
      query.subCategory = subCategory.trim();
    }

    // 5. Price Range Filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter = {};

      if (minPrice !== undefined && minPrice !== '') {
        const parsedMin = Number(minPrice);
        if (isNaN(parsedMin) || parsedMin < 0) {
          return errorResponse(res, { statusCode: 400, message: 'minPrice must be a non-negative number.' });
        }
        priceFilter.$gte = parsedMin;
      }

      if (maxPrice !== undefined && maxPrice !== '') {
        const parsedMax = Number(maxPrice);
        if (isNaN(parsedMax) || parsedMax < 0) {
          return errorResponse(res, { statusCode: 400, message: 'maxPrice must be a non-negative number.' });
        }
        priceFilter.$lte = parsedMax;
      }

      if (priceFilter.$gte !== undefined && priceFilter.$lte !== undefined && priceFilter.$gte > priceFilter.$lte) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'minPrice cannot be greater than maxPrice.',
        });
      }

      if (Object.keys(priceFilter).length > 0) {
        query.price = priceFilter;
      }
    }

    // 6. Condition Filter
    if (condition) {
      if (!Object.values(PRODUCT_CONDITIONS).includes(condition)) {
        return errorResponse(res, {
          statusCode: 400,
          message: `Invalid condition filter. Allowed: ${Object.values(PRODUCT_CONDITIONS).join(', ')}`,
        });
      }
      query.condition = condition;
    }

    // 7. Campus Location Filter (Safe regex pattern escaping)
    if (campusLocation && typeof campusLocation === 'string' && campusLocation.trim()) {
      const escaped = campusLocation.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.campusLocation = { $regex: new RegExp(escaped, 'i') };
    }

    // 8. Listing Type Filter
    if (listingType) {
      if (!Object.values(LISTING_TYPES).includes(listingType)) {
        return errorResponse(res, {
          statusCode: 400,
          message: `Invalid listingType filter. Allowed: ${Object.values(LISTING_TYPES).join(', ')}`,
        });
      }
      query.listingType = listingType;
    }

    // 9. Safe Sorting Mapping
    let sortOption = {};
    if (isTextSearch && sort === 'relevance') {
      sortOption = { score: { $meta: 'textScore' } };
    } else {
      switch (sort) {
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

    // 10. Execute Database Query
    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    let queryBuilder = Product.find(query);
    if (isTextSearch && sort === 'relevance') {
      queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
    }

    const products = await queryBuilder
      .populate('category', 'name slug icon')
      .populate('seller', 'name avatarUrl campusLocation reputation')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    return successResponse(res, {
      statusCode: 200,
      message: 'Products retrieved successfully.',
      data: {
        products,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Minimal safe in-memory view deduplication to prevent view-count inflation (15 minute window per IP/Product)
const VIEW_COOLDOWN_MS = 15 * 60 * 1000;
const viewCooldowns = new Map();

const shouldCountProductView = (clientIp, productId) => {
  const key = `${clientIp}:${productId}`;
  const now = Date.now();
  const lastView = viewCooldowns.get(key);
  if (lastView && now - lastView < VIEW_COOLDOWN_MS) {
    return false;
  }
  viewCooldowns.set(key, now);
  // Periodic cleanup if map grows too large
  if (viewCooldowns.size > 2000) {
    for (const [k, time] of viewCooldowns.entries()) {
      if (now - time > VIEW_COOLDOWN_MS) {
        viewCooldowns.delete(k);
      }
    }
  }
  return true;
};

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product detailed information
 * @access  Public
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const isNewView = shouldCountProductView(clientIp, id);

    // Atomically increment views count only for fresh views
    let product;
    if (isNewView) {
      product = await Product.findByIdAndUpdate(
        id,
        { $inc: { viewsCount: 1 } },
        { new: true }
      )
        .populate('category', 'name slug icon subcategories')
        .populate('seller', 'name avatarUrl department batch campusLocation bio reputation createdAt');
    } else {
      product = await Product.findById(id)
        .populate('category', 'name slug icon subcategories')
        .populate('seller', 'name avatarUrl department batch campusLocation bio reputation createdAt');
    }

    if (!product) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Product listing not found.',
      });
    }

    return successResponse(res, {
      statusCode: 200,
      message: 'Product details retrieved successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product details by owner
 * @access  Private (Product owner only)
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });
    }

    // Ownership verification
    if (product.seller.toString() !== user._id.toString()) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You are not authorized to update this listing.',
      });
    }

    const {
      title,
      description,
      category,
      subCategory,
      condition,
      price,
      listingType,
      campusLocation,
      exchangePreferences,
      tags,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return errorResponse(res, { statusCode: 400, message: 'Title cannot be empty.' });
      }
      product.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return errorResponse(res, { statusCode: 400, message: 'Description cannot be empty.' });
      }
      product.description = description.trim();
    }

    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid category identifier.' });
      }
      const cat = await Category.findById(category);
      if (!cat) {
        return errorResponse(res, { statusCode: 400, message: 'Selected category does not exist.' });
      }
      product.category = cat._id;
    }

    if (subCategory !== undefined) product.subCategory = subCategory.trim();

    if (condition !== undefined) {
      if (!Object.values(PRODUCT_CONDITIONS).includes(condition)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid condition value.' });
      }
      product.condition = condition;
    }

    if (listingType !== undefined) {
      if (!Object.values(LISTING_TYPES).includes(listingType)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid listing type value.' });
      }
      product.listingType = listingType;
    }

    if (price !== undefined || listingType !== undefined) {
      const activeType = listingType || product.listingType;
      const numPrice = price !== undefined ? Number(price) : product.price;

      if (activeType === LISTING_TYPES.SELL && (isNaN(numPrice) || numPrice <= 0)) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Price must be greater than zero for items listed for sale.',
        });
      }
      product.price = activeType === LISTING_TYPES.GIVEAWAY ? 0 : numPrice;
    }

    if (campusLocation !== undefined) {
      if (typeof campusLocation !== 'string' || campusLocation.trim().length === 0) {
        return errorResponse(res, { statusCode: 400, message: 'Campus location cannot be empty.' });
      }
      product.campusLocation = campusLocation.trim();
    }

    if (exchangePreferences !== undefined) product.exchangePreferences = exchangePreferences.trim();

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        product.tags = tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof tags === 'string') {
        product.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Handle new uploaded images if supplied
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newImages = req.files.map((file, idx) => ({
        url: `/uploads/products/${file.filename}`,
        publicId: file.filename,
        isThumbnail: product.images.length === 0 && idx === 0,
      }));

      // Respect max 5 images limit
      if (product.images.length + newImages.length > 5) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'A product listing cannot have more than 5 images in total.',
        });
      }
      product.images.push(...newImages);
    }

    await product.save();

    const updated = await Product.findById(product._id)
      .populate('category', 'name slug icon')
      .populate('seller', 'name avatarUrl campusLocation reputation');

    return successResponse(res, {
      statusCode: 200,
      message: 'Product updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/products/:id/status
 * @desc    Update listing availability status (available, reserved, sold, inactive)
 * @access  Private (Product owner only)
 */
export const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }

    if (!status || !Object.values(PRODUCT_STATUS).includes(status)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid status. Allowed values: ${Object.values(PRODUCT_STATUS).join(', ')}`,
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });
    }

    if (product.seller.toString() !== user._id.toString()) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You are not authorized to update the status of this listing.',
      });
    }

    const previousStatus = product.status;
    product.status = status;
    await product.save();

    try {
      await notifyWishlistOnStatusChange(product, previousStatus, status);
    } catch (notifyError) {
      console.error(`[Notification] Status update notify failed: ${notifyError.message}`);
    }

    return successResponse(res, {
      statusCode: 200,
      message: `Product status updated to ${status}.`,
      data: {
        id: product._id,
        status: product.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete/deactivate product listing
 * @access  Private (Product owner only)
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid product ID format.' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, { statusCode: 404, message: 'Product listing not found.' });
    }

    if (product.seller.toString() !== user._id.toString() && user.role !== USER_ROLES.ADMIN) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You are not authorized to delete this listing.',
      });
    }

    // Soft-delete to preserve references and existing wishlist records
    const previousStatus = product.status;
    product.status = PRODUCT_STATUS.INACTIVE;
    await product.save();

    try {
      await notifyWishlistOnStatusChange(product, previousStatus, PRODUCT_STATUS.INACTIVE);
    } catch (notifyError) {
      console.error(`[Notification] Product deletion notify failed: ${notifyError.message}`);
    }

    return successResponse(res, {
      statusCode: 200,
      message: 'Product listing deactivated/deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
