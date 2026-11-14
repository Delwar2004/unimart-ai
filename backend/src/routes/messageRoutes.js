import express from 'express';
import { getUnreadMessageCount } from '../controllers/conversationController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/unread-count', protect, getUnreadMessageCount);

export default router;
