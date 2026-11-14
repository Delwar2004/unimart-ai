import express from 'express';
import {
  createExchangeRequest,
  getSentExchangeRequests,
  getReceivedExchangeRequests,
  getExchangeRequest,
  cancelExchangeRequest,
  acceptExchangeRequest,
  rejectExchangeRequest,
} from '../controllers/exchangeController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createExchangeRequest);
router.get('/sent', getSentExchangeRequests);
router.get('/received', getReceivedExchangeRequests);
router.get('/:id', getExchangeRequest);
router.patch('/:id/cancel', cancelExchangeRequest);
router.patch('/:id/accept', acceptExchangeRequest);
router.patch('/:id/reject', rejectExchangeRequest);

export default router;
