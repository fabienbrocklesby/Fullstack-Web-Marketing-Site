/**
 * Admin internal token middleware
 * Protects sensitive internal endpoints that should only be accessed
 * by authorized services or admins with a secret token
 * 
 * Set ADMIN_INTERNAL_TOKEN in environment variables
 * Pass token via X-Admin-Token header
 */

const { audit } = require("../utils/audit-logger");

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const adminToken = process.env.ADMIN_INTERNAL_TOKEN;

    // If no token is configured, block all access in production
    if (!adminToken) {
      if (process.env.NODE_ENV === 'production') {
        strapi.log.warn(`Blocked access to protected endpoint (no ADMIN_INTERNAL_TOKEN configured): ${ctx.request.path}`);
        ctx.status = 403;
        ctx.body = {
          error: 'Forbidden',
          message: 'This endpoint is disabled',
        };
        return;
      }
      // In development, allow access but log warning
      strapi.log.warn(`ADMIN_INTERNAL_TOKEN not set - allowing access in development mode: ${ctx.request.path}`);
      await next();
      return;
    }

    // Validate the token from header
    const providedToken = ctx.request.headers['x-admin-token'];

    if (!providedToken) {
      ctx.status = 401;
      ctx.body = {
        error: 'Unauthorized',
        message: 'Missing X-Admin-Token header',
      };
      return;
    }

    // Constant-time comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(adminToken);
    const providedBuffer = Buffer.from(providedToken);

    if (tokenBuffer.length !== providedBuffer.length) {
      ctx.status = 403;
      ctx.body = {
        error: 'Forbidden',
        message: 'Invalid admin token',
      };
      return;
    }

    const crypto = require('crypto');
    if (!crypto.timingSafeEqual(tokenBuffer, providedBuffer)) {
      audit.adminTokenInvalid(ctx, ctx.request.path);
      ctx.status = 403;
      ctx.body = {
        error: 'Forbidden',
        message: 'Invalid admin token',
      };
      return;
    }

    await next();
  };
};
