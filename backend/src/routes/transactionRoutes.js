import express from 'express';
import {
  getTransactions,
  getTransaction,
  confirmTransaction,
  cancelTransaction,
} from '../controllers/transactionController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getTransactions);
router.get('/:id', getTransaction);
router.patch('/:id/confirm', confirmTransaction);
router.patch('/:id/cancel', cancelTransaction);

export default router;
