import express from 'express';
import {
  createBuyRequest,
  getSentBuyRequests,
  getReceivedBuyRequests,
  getBuyRequest,
  cancelBuyRequest,
  acceptBuyRequest,
  rejectBuyRequest,
} from '../controllers/buyRequestController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createBuyRequest);
router.get('/sent', getSentBuyRequests);
router.get('/received', getReceivedBuyRequests);
router.get('/:id', getBuyRequest);
router.patch('/:id/cancel', cancelBuyRequest);
router.patch('/:id/accept', acceptBuyRequest);
router.patch('/:id/reject', rejectBuyRequest);

export default router;
