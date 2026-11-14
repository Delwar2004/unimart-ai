import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStatus,
} from '../controllers/productController.js';
import { protect } from '../middlewares/auth.js';
import { uploadProductImagesMiddleware } from '../middlewares/upload.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Protected routes (Verified students)
router.post('/', protect, uploadProductImagesMiddleware.array('images', 5), createProduct);
router.put('/:id', protect, uploadProductImagesMiddleware.array('images', 5), updateProduct);
router.patch('/:id/status', protect, updateProductStatus);
router.delete('/:id', protect, deleteProduct);

export default router;
