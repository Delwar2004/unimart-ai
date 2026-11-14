import express from 'express';
import { protect } from '../middlewares/auth.js';
import { createReport, getMyReports, getReport, withdrawReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/my', protect, getMyReports);
router.post('/', protect, createReport);
router.get('/:id', protect, getReport);
router.delete('/:id', protect, withdrawReport);

export default router;
