import express from 'express';
import {
  createConversation,
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/conversationController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createConversation);
router.get('/', getConversations);
router.get('/:conversationId', getConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/messages', sendMessage);
router.patch('/:conversationId/read', markConversationRead);

export default router;
