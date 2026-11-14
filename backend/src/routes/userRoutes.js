import express from 'express';
import {
  getOwnProfile,
  updateOwnProfile,
  uploadAvatar,
  getPublicProfile,
} from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';
import { uploadAvatarMiddleware } from '../middlewares/upload.js';

const router = express.Router();

// Private profile routes
router.get('/profile', protect, getOwnProfile);
router.put('/profile', protect, updateOwnProfile);
router.put('/profile/avatar', protect, uploadAvatarMiddleware.single('avatar'), uploadAvatar);

// Public seller profile route
router.get('/:id', getPublicProfile);

export default router;
