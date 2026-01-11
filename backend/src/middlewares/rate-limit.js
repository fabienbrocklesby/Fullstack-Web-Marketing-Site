/**
 * Rate limiting middleware for sensitive endpoints
 * Uses in-memory buckets (for single-instance deployments)
 * For multi-instance deployments, replace with Redis-backed solution
 */

const buckets = new Map();

// Cleanup stale buckets periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of buckets.entries()) {
    if (now - data.lastAccess > 5 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter with configurable options
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.max - Max requests per window (default: 10)
 * @param {string} options.keyPrefix - Prefix for bucket keys (default: 'rate')
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 10; // 10 requests per minute default
  const keyPrefix = options.keyPrefix || 'rate';

  return async (ctx, next) => {
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], lastAccess: now };
      buckets.set(key, bucket);
    }

    // Filter to only keep timestamps within the window
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < windowMs);
    bucket.lastAccess = now;

    if (bucket.timestamps.length >= max) {
      ctx.status = 429;
      ctx.set('Retry-After', Math.ceil(windowMs / 1000));
      ctx.body = {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please wait ${Math.ceil(windowMs / 1000)} seconds.`,
        retryAfter: Math.ceil(windowMs / 1000),
      };
      return;
    }

    bucket.timestamps.push(now);
    await next();
  };
}

// Pre-configured rate limiters for different endpoint types
module.exports = {
  // Strict rate limit for auth endpoints (login, register)
  // 5 requests per minute per IP
  authRateLimit: createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    keyPrefix: 'auth',
  }),

  // License activation/deactivation rate limit
  // 10 requests per minute per IP
  licenseRateLimit: createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'license',
  }),

  // Purchase processing rate limit
  // 3 requests per minute per IP
  purchaseRateLimit: createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    keyPrefix: 'purchase',
  }),

  // Generic API rate limit
  // 30 requests per minute per IP
  apiRateLimit: createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'api',
  }),

  // Factory function for custom rate limiters
  createRateLimiter,
};
