import express from 'express';
import { protect } from '../middlewares/auth.js';
import { uploadClassificationImageMiddleware } from '../middlewares/upload.js';
import { aiLimiter } from '../middlewares/rateLimiter.js';
import {
  generateProductDescription,
  suggestCategory,
  interpretSearchQuery,
  getPersonalizedRecommendations,
  askAssistant,
  estimatePrice,
  classifyProductImage,
} from '../controllers/aiController.js';

const router = express.Router();

// Require student/admin authentication and apply rate limiter for all AI features
router.use(protect, aiLimiter);

router.post('/product-description', generateProductDescription);
router.post('/suggest-category', suggestCategory);
router.post('/search-query', interpretSearchQuery);
router.get('/recommendations', getPersonalizedRecommendations);
router.post('/assistant', askAssistant);
router.post('/estimate-price', estimatePrice);
router.post(
  '/classify-product-image',
  uploadClassificationImageMiddleware.single('image'),
  classifyProductImage
);

export default router;
