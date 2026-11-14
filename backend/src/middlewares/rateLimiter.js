import { errorResponse } from '../utils/response.js';

/**
 * Lightweight in-memory sliding-window rate limiter
 * Protects against brute-force attacks, credential stuffing, and API resource abuse.
 */
class MemoryRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // default 15 minutes
    this.max = options.max || 100; // default max requests per window
    this.message = options.message || 'Too many requests from this IP. Please try again later.';
    this.hits = new Map();

    // Periodic cleanup of expired entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.hits.entries()) {
        const valid = timestamps.filter((t) => now - t < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, valid);
        }
      }
    }, 5 * 60 * 1000);

    // Prevent cleanup interval from holding process open in test environments
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  reset() {
    this.hits.clear();
  }

  middleware() {
    return (req, res, next) => {
      // Determine client identifier: authenticated user ID or remote IP address
      const clientIp =
        req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown';

      const isLoopback =
        clientIp === '127.0.0.1' ||
        clientIp === '::1' ||
        clientIp === '::ffff:127.0.0.1' ||
        clientIp === 'localhost';

      // In non-production environments, do not lock out local development/browsing on localhost
      if (
        (process.env.NODE_ENV !== 'production' && isLoopback && req.headers['x-test-rate-limit'] !== 'true') ||
        (process.env.NODE_ENV !== 'production' && req.headers['x-bypass-rate-limit'] === 'true')
      ) {
        return next();
      }

      const key = req.user ? `user:${req.user._id}` : `ip:${clientIp}`;
      const now = Date.now();
      const userHits = this.hits.get(key) || [];
      const recentHits = userHits.filter((t) => now - t < this.windowMs);

      if (recentHits.length >= this.max) {
        const oldestHit = recentHits[0];
        const retryAfterSeconds = Math.ceil((this.windowMs - (now - oldestHit)) / 1000);

        res.setHeader('Retry-After', retryAfterSeconds);
        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil((oldestHit + this.windowMs) / 1000));

        return errorResponse(res, {
          statusCode: 429,
          message: this.message,
        });
      }

      recentHits.push(now);
      this.hits.set(key, recentHits);

      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - recentHits.length));

      next();
    };
  }
}

/**
 * Strict limiter for sensitive authentication endpoints (Login, Register, Password Reset)
 * 20 attempts per 15 minutes per IP in production; 200 in development
 */
export const authLimiterInstance = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});
export const authLimiter = authLimiterInstance.middleware();

/**
 * Limiter for AI generation endpoints
 * 30 requests per minute
 */
export const aiLimiterInstance = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 100,
  message: 'AI request limit reached. Please wait a minute before making further requests.',
});
export const aiLimiter = aiLimiterInstance.middleware();

/**
 * General API limiter for all other endpoints
 * 400 requests per 15 minutes
 */
export const generalApiLimiterInstance = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 400 : 2000,
  message: 'API rate limit exceeded. Please slow down your requests.',
});
export const generalApiLimiter = generalApiLimiterInstance.middleware();
