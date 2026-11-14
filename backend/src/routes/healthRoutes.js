import express from 'express';
import { getDBStatus } from '../config/db.js';
import { successResponse } from '../utils/response.js';

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    API and Database health status
 * @access  Public
 */
router.get('/health', (req, res) => {
  const dbStatus = getDBStatus();

  return successResponse(res, {
    statusCode: 200,
    message: 'UniMart AI API is running',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        engine: 'MongoDB',
        state: dbStatus.state,
        connected: dbStatus.isConnected,
      },
    },
  });
});

export default router;
