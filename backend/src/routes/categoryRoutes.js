import express from 'express';
import { getCategories, createCategory } from '../controllers/categoryController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../constants/index.js';

const router = express.Router();

// Public
router.get('/', getCategories);

// Admin only
router.post('/', protect, authorize(USER_ROLES.ADMIN), createCategory);

export default router;
