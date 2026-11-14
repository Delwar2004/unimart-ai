import express from 'express';
import {
  createWantedPost,
  getWantedPosts,
  getWantedPost,
  updateWantedPost,
  updateWantedPostStatus,
  deleteWantedPost,
  contactWantedAuthor,
} from '../controllers/wantedPostController.js';
import { protect, optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', optionalProtect, getWantedPosts);
router.get('/:id', optionalProtect, getWantedPost);
router.post('/', protect, createWantedPost);
router.put('/:id', protect, updateWantedPost);
router.patch('/:id/status', protect, updateWantedPostStatus);
router.delete('/:id', protect, deleteWantedPost);
router.post('/:id/contact', protect, contactWantedAuthor);

export default router;
