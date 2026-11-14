import express from 'express';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../constants/index.js';
import {
  getReports,
  getReportById,
  resolveReport,
  dismissReport,
  moderateTarget,
} from '../controllers/adminController.js';
import { getAnalyticsOverview } from '../controllers/adminAnalyticsController.js';

const router = express.Router();

// Strict admin-only barrier for all admin routes
router.use(protect, authorize(USER_ROLES.ADMIN));

// Analytics Endpoints
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics', getAnalyticsOverview);

router.get('/reports', getReports);
router.get('/reports/:id', getReportById);
router.route('/reports/:id/resolve').patch(resolveReport).put(resolveReport);
router.route('/reports/:id/dismiss').patch(dismissReport).put(dismissReport);
router.post('/moderate-target', moderateTarget);
router.post('/moderate/:targetType/:targetId', moderateTarget);

export default router;
