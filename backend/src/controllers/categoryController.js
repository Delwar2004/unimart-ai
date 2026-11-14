import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { initialCategories } from '../config/categorySeed.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * @route   GET /api/v1/categories
 * @desc    Get all active categories and their subcategories
 * @access  Public
 */
export const getCategories = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return successResponse(res, {
        statusCode: 200,
        message: 'Categories retrieved successfully.',
        data: initialCategories.map((c, i) => ({ ...c, _id: `cat_${i + 1}` })),
      });
    }

    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    return successResponse(res, {
      statusCode: 200,
      message: 'Categories retrieved successfully.',
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/categories
 * @desc    Create new category (prepared for Admin/privileged role)
 * @access  Private / Admin
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, icon, subcategories } = req.body;

    if (!name || !slug) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Category name and slug are required.',
      });
    }

    const cleanSlug = slug.trim().toLowerCase();
    const existing = await Category.findOne({ slug: cleanSlug });
    if (existing) {
      return errorResponse(res, {
        statusCode: 409,
        message: 'A category with this slug already exists.',
      });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: cleanSlug,
      description: description ? description.trim() : '',
      icon: icon ? icon.trim() : '',
      subcategories: Array.isArray(subcategories) ? subcategories.map((s) => s.trim()).filter(Boolean) : [],
      isActive: true,
    });

    return successResponse(res, {
      statusCode: 201,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};
