import express from 'express';
import {
  createGiveawayRequest,
  getSentGiveawayRequests,
  getReceivedGiveawayRequests,
  getGiveawayRequest,
  cancelGiveawayRequest,
  acceptGiveawayRequest,
  rejectGiveawayRequest,
} from '../controllers/giveawayController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createGiveawayRequest);
router.get('/sent', getSentGiveawayRequests);
router.get('/received', getReceivedGiveawayRequests);
router.get('/:id', getGiveawayRequest);
router.patch('/:id/cancel', cancelGiveawayRequest);
router.patch('/:id/accept', acceptGiveawayRequest);
router.patch('/:id/reject', rejectGiveawayRequest);

export default router;
