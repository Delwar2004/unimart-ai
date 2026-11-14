import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  checkEligibility,
  createReview,
  deleteReview,
  getMyReviews,
  getProductReviews,
  getUserReviews,
  updateReview,
} from '../controllers/reviewController.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.get('/user/:userId', getUserReviews);
router.get('/my', protect, getMyReviews);
router.get('/eligible/:transactionId', protect, checkEligibility);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

export default router;
