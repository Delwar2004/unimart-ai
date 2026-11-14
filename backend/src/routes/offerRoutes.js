import express from 'express';
import {
  createOffer,
  getSentOffers,
  getReceivedOffers,
  getOffer,
  cancelOffer,
  acceptOffer,
  rejectOffer,
} from '../controllers/offerController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createOffer);
router.get('/sent', getSentOffers);
router.get('/received', getReceivedOffers);
router.get('/:id', getOffer);
router.patch('/:id/cancel', cancelOffer);
router.patch('/:id/accept', acceptOffer);
router.patch('/:id/reject', rejectOffer);

export default router;
