/**
 * AI rate limiting middleware
 * Limits AI endpoint calls to 10 requests per minute per customer.
 *
 * Keys by customer ID (from ai-auth) to prevent:
 * - Bypass via IP rotation
 * - Unfair punishment of users behind NAT
 */

const { audit } = require("../utils/audit-logger");
const { ErrorCodes } = require("../utils/api-responses");

const buckets = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

// Cleanup stale buckets periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of buckets.entries()) {
    if (now - data.lastAccess > 5 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Key by customer ID from AI token (set by ai-auth middleware)
    // Falls back to IP only if somehow ai-auth didn't run (shouldn't happen)
    const customerId = ctx.state?.ai?.customerId;
    const ip = ctx.request.ip || ctx.ip || "unknown";
    const key = customerId ? `ai:customer:${customerId}` : `ai:ip:${ip}`;

    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], lastAccess: now };
      buckets.set(key, bucket);
    }

    // Filter to only keep timestamps within the window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);
    bucket.lastAccess = now;

    if (bucket.timestamps.length >= MAX_REQUESTS) {
      audit.rateLimited(ctx, "ai", {
        customerId,
        ip,
        requestCount: bucket.timestamps.length,
        max: MAX_REQUESTS,
      });
      ctx.status = 429;
      ctx.set("Retry-After", Math.ceil(WINDOW_MS / 1000));
      ctx.body = {
        ok: false,
        code: ErrorCodes.RATE_LIMITED,
        message: `Rate limit exceeded. Please wait ${Math.ceil(WINDOW_MS / 1000)} seconds.`,
        details: {
          retryAfter: Math.ceil(WINDOW_MS / 1000),
        },
      };
      return;
    }

    bucket.timestamps.push(now);
    await next();
  };
};
