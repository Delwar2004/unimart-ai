import express from 'express';
import { confirmExchangeTransaction, cancelExchangeTransaction } from '../controllers/exchangeController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);
router.patch('/:id/confirm', confirmExchangeTransaction);
router.patch('/:id/cancel', cancelExchangeTransaction);

export default router;
