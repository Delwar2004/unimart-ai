import mongoose from 'mongoose';
import { Wishlist } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';
import { successResponse, errorResponse } from '../utils/response.js';

const SELLER_PUBLIC_FIELDS = 'name avatarUrl campusLocation reputation';

const isValidObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const toPublicSeller = (seller) => {
  if (!seller || typeof seller !== 'object') return null;
  return {
    _id: seller._id,
    name: seller.name,
    avatarUrl: seller.avatarUrl || '',
    campusLocation: seller.campusLocation || '',
    reputation: {
      averageRating: seller.reputation?.averageRating || 0,
      ratingsCount: seller.reputation?.ratingsCount || 0,
      successfulTransactions: seller.reputation?.successfulTransactions || 0,
    },
  };
};

const toWishlistProduct = (product) => {
  if (!product) return null;
  return {
    _id: product._id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    images: product.images || [],
    condition: product.condition,
    listingType: product.listingType,
    status: product.status,
    campusLocation: product.campusLocation,
    seller: toPublicSeller(product.seller),
  };
};

/**
 * @route   GET /api/v1/wishlist
 * @desc    List the authenticated user's wishlist
 * @access  Private
 */
export const getWishlist = async (req, res, next) => {
  try {
    const entries = await Wishlist.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'product',
        select: 'title price currency images condition listingType status campusLocation seller',
        populate: {
          path: 'seller',
          select: SELLER_PUBLIC_FIELDS,
        },
      })
      .lean();

    const items = entries.map((entry) => ({
      _id: entry._id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      product: toWishlistProduct(entry.product),
    }));

    return successResponse(res, {
      statusCode: 200,
      message: 'Wishlist retrieved successfully.',
      data: {
        items,
        count: items.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/wishlist/:productId
 * @desc    Save a product to the authenticated user's wishlist
 * @access  Private (verified)
 */
export const addToWishlist = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before saving marketplace items.',
      });
    }

    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Product listing not found.',
      });
    }

    const existing = await Wishlist.findOne({ user: req.user._id, product: product._id });
    if (existing) {
      return successResponse(res, {
        statusCode: 200,
        message: 'Product is already in your wishlist.',
        data: {
          wishlisted: true,
          itemId: existing._id,
        },
      });
    }

    try {
      const created = await Wishlist.create({
        user: req.user._id,
        product: product._id,
      });

      return successResponse(res, {
        statusCode: 201,
        message: 'Product added to your wishlist.',
        data: {
          wishlisted: true,
          itemId: created._id,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        const duplicate = await Wishlist.findOne({ user: req.user._id, product: product._id });
        return successResponse(res, {
          statusCode: 200,
          message: 'Product is already in your wishlist.',
          data: {
            wishlisted: true,
            itemId: duplicate?._id || null,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/wishlist/:productId
 * @desc    Remove a product from the authenticated user's wishlist
 * @access  Private
 */
export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const deleted = await Wishlist.findOneAndDelete({
      user: req.user._id,
      product: productId,
    });

    return successResponse(res, {
      statusCode: 200,
      message: deleted ? 'Product removed from your wishlist.' : 'Product was not in your wishlist.',
      data: {
        wishlisted: false,
        removed: Boolean(deleted),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/wishlist/check/:productId
 * @desc    Check whether the current user has saved a product
 * @access  Private
 */
export const checkWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid product ID format.',
      });
    }

    const existing = await Wishlist.exists({
      user: req.user._id,
      product: productId,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Wishlist status retrieved.',
      data: {
        wishlisted: Boolean(existing),
      },
    });
  } catch (error) {
    next(error);
  }
};
