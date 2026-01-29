/**
 * AI Auth Middleware (Portal AI API - Stage 1)
 *
 * Validates AI tokens for AI-specific endpoints.
 * Similar to customer-auth but for AI tokens only.
 *
 * Expects: Authorization: Bearer <ai_token>
 * Sets: ctx.state.ai = { customerId, entitlementId, jti }
 * Optionally sets: ctx.state.customer (if entitlement verification needed)
 */

"use strict";

const { verifyAiToken } = require("../utils/ai-token");
const { sendError, ErrorCodes } = require("../utils/api-responses");

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Extract bearer token
    const authHeader = ctx.request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(
        ctx,
        401,
        ErrorCodes.UNAUTHENTICATED,
        "Missing or invalid Authorization header"
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return sendError(
        ctx,
        401,
        ErrorCodes.UNAUTHENTICATED,
        "No token provided"
      );
    }

    // Verify AI token
    const result = verifyAiToken(token);
    if (!result.valid) {
      // Map internal codes to API error codes
      let httpStatus = 401;
      let errorCode = ErrorCodes.UNAUTHENTICATED;

      if (result.code === "TOKEN_EXPIRED") {
        errorCode = ErrorCodes.UNAUTHENTICATED;
      } else if (result.code === "INVALID_TOKEN_TYPE") {
        // Token is valid JWT but wrong type (e.g., customer token on AI endpoint)
        errorCode = ErrorCodes.FORBIDDEN;
        httpStatus = 403;
      }

      return sendError(ctx, httpStatus, errorCode, result.error);
    }

    const { claims } = result;

    // Load customer and verify still active
    const customer = await strapi.entityService.findOne(
      "api::customer.customer",
      claims.customerId
    );

    if (!customer) {
      return sendError(
        ctx,
        401,
        ErrorCodes.UNAUTHENTICATED,
        "Customer not found"
      );
    }

    if (!customer.isActive) {
      return sendError(
        ctx,
        403,
        ErrorCodes.FORBIDDEN,
        "Customer account is deactivated"
      );
    }

    // If entitlementId is in token, verify it still belongs to customer and is active
    if (claims.entitlementId) {
      const entitlement = await strapi.entityService.findOne(
        "api::entitlement.entitlement",
        claims.entitlementId,
        { populate: ["customer"] }
      );

      if (!entitlement) {
        return sendError(
          ctx,
          403,
          ErrorCodes.ENTITLEMENT_NOT_FOUND,
          "Entitlement not found"
        );
      }

      // Verify ownership
      const entitlementCustomerId =
        entitlement.customer?.id || entitlement.customer;
      if (entitlementCustomerId !== customer.id) {
        return sendError(
          ctx,
          403,
          ErrorCodes.FORBIDDEN,
          "Entitlement does not belong to this customer"
        );
      }

      // Verify still active
      if (entitlement.status !== "active") {
        return sendError(
          ctx,
          403,
          ErrorCodes.ENTITLEMENT_NOT_ACTIVE,
          "Entitlement is no longer active"
        );
      }
    }

    // Attach AI context to request state
    ctx.state.ai = {
      customerId: claims.customerId,
      entitlementId: claims.entitlementId || null,
      jti: claims.jti,
    };
    ctx.state.customer = customer;

    await next();
  };
};
