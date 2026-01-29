/**
 * Customer Auth Middleware for AI Token Minting
 *
 * Like customer-auth.js but returns portal envelope errors instead of Strapi defaults.
 * Used specifically for /api/v1/ai/token to maintain contract compliance.
 */

const jwt = require("jsonwebtoken");
const { sendError, ErrorCodes } = require("../utils/api-responses");

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const authHeader = ctx.request.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return sendError(ctx, 401, ErrorCodes.UNAUTHENTICATED, "No token provided");
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret",
      );

      // Must be a customer token
      if (decoded.type !== "customer") {
        return sendError(ctx, 401, ErrorCodes.UNAUTHENTICATED, "Invalid token type");
      }

      // Get customer from database
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        decoded.id,
      );

      if (!customer) {
        return sendError(ctx, 401, ErrorCodes.UNAUTHENTICATED, "Customer not found");
      }

      if (!customer.isActive) {
        return sendError(ctx, 401, ErrorCodes.UNAUTHENTICATED, "Customer account is deactivated");
      }

      // Add customer to context
      ctx.state.customer = customer;

      await next();
    } catch (error) {
      // JWT errors (expired, malformed, invalid signature)
      console.error("Customer auth error:", error.message);
      return sendError(ctx, 401, ErrorCodes.UNAUTHENTICATED, "Invalid token");
    }
  };
};
