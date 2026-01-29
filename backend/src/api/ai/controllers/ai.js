/**
 * AI Controller (Portal AI API - Stage 1)
 *
 * Handles AI-related endpoints including token minting and settings assistant.
 */

"use strict";

const { mintAiToken } = require("../../../utils/ai-token");
const { sendOk, sendError, ErrorCodes } = require("../../../utils/api-responses");
const { audit } = require("../../../utils/audit-logger");
const settingsAssistantService = require("../services/settings-assistant");
const engraveAssistantService = require("../services/engrave-assistant");

module.exports = {
  /**
   * POST /api/v1/ai/token
   *
   * Mint an AI token for the desktop app.
   * Requires: customer-auth middleware (ctx.state.customer populated)
   * Requires: At least one active entitlement for the customer.
   *
   * Response (contract):
   * {
   *   "ok": true,
   *   "data": {
   *     "token": "...",
   *     "expiresAt": "2026-01-29T12:34:56Z"
   *   }
   * }
   */
  async mintToken(ctx) {
    const customer = ctx.state.customer;

    if (!customer) {
      audit.aiTokenMint(ctx, {
        outcome: "failure",
        reason: "no_customer_context",
      });
      return sendError(
        ctx,
        401,
        ErrorCodes.UNAUTHENTICATED,
        "Customer authentication required"
      );
    }

    try {
      // Find an active entitlement for this customer
      // Priority: prefer subscription (non-lifetime) over lifetime, then newest
      const entitlements = await strapi.entityService.findMany(
        "api::entitlement.entitlement",
        {
          filters: {
            customer: customer.id,
            status: "active",
          },
          sort: [
            { isLifetime: "asc" }, // Subscriptions first (isLifetime=false)
            { createdAt: "desc" }, // Newest first
          ],
          limit: 1,
        }
      );

      if (!entitlements || entitlements.length === 0) {
        audit.aiTokenMint(ctx, {
          outcome: "failure",
          reason: "no_active_entitlement",
          customerId: customer.id,
        });
        return sendError(
          ctx,
          403,
          ErrorCodes.ENTITLEMENT_NOT_ACTIVE,
          "No active entitlement found. AI features require an active subscription or license."
        );
      }

      const entitlement = entitlements[0];

      // Mint the AI token
      const { token, expiresAt, jti } = mintAiToken({
        customerId: customer.id,
        entitlementId: entitlement.id,
      });

      // Audit success (no raw token logged)
      audit.aiTokenMint(ctx, {
        outcome: "success",
        customerId: customer.id,
        entitlementId: entitlement.id,
        jti,
      });

      // Return per contract: { ok: true, data: { token, expiresAt } }
      return sendOk(ctx, {
        data: {
          token,
          expiresAt,
        },
      });
    } catch (error) {
      strapi.log.error(`[AI] Token mint error: ${error.message}`);
      audit.aiTokenMint(ctx, {
        outcome: "failure",
        reason: "internal_error",
        customerId: customer.id,
        error: error.message,
      });
      return sendError(
        ctx,
        500,
        ErrorCodes.INTERNAL_ERROR,
        "Failed to mint AI token"
      );
    }
  },

  /**
   * POST /api/v1/ai/settings-assistant
   *
   * Settings Assistant endpoint - proxies to OpenAI.
   * Requires: ai-auth middleware (ctx.state.ai populated)
   *
   * Request:
   * {
   *   "prompt": "How do I enable dark mode?",
   *   "context": { "currentSettings": { "theme": "light" } }
   * }
   *
   * Response (contract):
   * {
   *   "ok": true,
   *   "data": {
   *     "response": "...",
   *     "model": "gpt-4o-mini"
   *   }
   * }
   */
  async settingsAssistant(ctx) {
    const { customerId, entitlementId, jti } = ctx.state.ai;
    const body = ctx.request.body;

    // Validate payload
    const validation = settingsAssistantService.validatePayload(body);
    if (!validation.valid) {
      audit.aiSettingsAssistant(ctx, {
        outcome: "failure",
        reason: "validation_error",
        customerId,
        entitlementId,
        jti,
      });
      return sendError(
        ctx,
        400,
        ErrorCodes.VALIDATION_ERROR,
        validation.error,
        validation.details
      );
    }

    // Call OpenAI via service
    const result = await settingsAssistantService.callOpenAI(
      body.prompt,
      body.context
    );

    // Audit the call (never log prompt content)
    audit.aiSettingsAssistant(ctx, {
      outcome: result.success ? "success" : "failure",
      reason: result.success ? null : result.error?.code,
      customerId,
      entitlementId,
      jti,
      latencyMs: result.latencyMs,
    });

    if (!result.success) {
      // Map provider error code to ErrorCodes
      const errorCode = result.error.code === "PROVIDER_TIMEOUT"
        ? "PROVIDER_TIMEOUT"
        : result.error.code === "PROVIDER_RATE_LIMITED"
          ? "PROVIDER_RATE_LIMITED"
          : result.error.code === "PROVIDER_ERROR"
            ? "PROVIDER_ERROR"
            : result.error.code === "VALIDATION_ERROR"
              ? ErrorCodes.VALIDATION_ERROR
              : ErrorCodes.INTERNAL_ERROR;

      return sendError(
        ctx,
        result.error.status,
        errorCode,
        result.error.message
      );
    }

    // Success
    return sendOk(ctx, {
      data: result.data,
    });
  },

  /**
   * POST /api/v1/ai/engrave-assistant
   *
   * Image-based settings proposal endpoint - proxies to OpenAI vision.
   * Requires: ai-auth middleware (ctx.state.ai populated)
   * Content-Type: multipart/form-data with fields:
   *  - image (file)
   *  - payload (JSON string)
   */
  async engraveAssistant(ctx) {
    const { customerId, entitlementId, jti } = ctx.state.ai;
    const { files, body } = ctx.request || {};

    const imageField = files?.image;
    const imageFile = Array.isArray(imageField) ? imageField[0] : imageField;

    if (!body || typeof body.payload !== "string") {
      audit.aiEngraveAssistant(ctx, {
        outcome: "failure",
        reason: "validation_error",
        customerId,
        entitlementId,
        jti,
        imageBytes: imageFile?.size || null,
        imageType: imageFile?.type || imageFile?.mimetype || null,
      });
      return sendError(
        ctx,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "payload is required and must be a JSON string",
        { field: "payload" }
      );
    }

    let payload;
    try {
      payload = JSON.parse(body.payload);
    } catch (error) {
      audit.aiEngraveAssistant(ctx, {
        outcome: "failure",
        reason: "validation_error",
        customerId,
        entitlementId,
        jti,
        imageBytes: imageFile?.size || null,
        imageType: imageFile?.type || imageFile?.mimetype || null,
      });
      return sendError(
        ctx,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "payload must be valid JSON",
        { field: "payload" }
      );
    }

    const validation = engraveAssistantService.validateRequest(payload, imageFile);
    if (!validation.valid) {
      audit.aiEngraveAssistant(ctx, {
        outcome: "failure",
        reason: "validation_error",
        customerId,
        entitlementId,
        jti,
        imageBytes: imageFile?.size || null,
        imageType: imageFile?.type || imageFile?.mimetype || null,
        promptLength: typeof payload?.prompt === "string" ? payload.prompt.trim().length : null,
        settingsKeysCount: payload?.availableSettings
          ? Object.keys(payload.availableSettings).length
          : null,
      });
      return sendError(
        ctx,
        400,
        ErrorCodes.VALIDATION_ERROR,
        validation.error,
        validation.details
      );
    }

    const result = await engraveAssistantService.callOpenAI(payload, imageFile);

    audit.aiEngraveAssistant(ctx, {
      outcome: result.success ? "success" : "failure",
      reason: result.success ? null : result.error?.code,
      customerId,
      entitlementId,
      jti,
      latencyMs: result.latencyMs,
      imageBytes: imageFile?.size || null,
      imageType: imageFile?.type || imageFile?.mimetype || null,
      promptLength: payload.prompt.trim().length,
      settingsKeysCount: Object.keys(payload.availableSettings || {}).length,
    });

    if (!result.success) {
      const errorCode = result.error.code === "PROVIDER_TIMEOUT"
        ? "PROVIDER_TIMEOUT"
        : result.error.code === "PROVIDER_RATE_LIMITED"
          ? "PROVIDER_RATE_LIMITED"
          : result.error.code === "PROVIDER_ERROR"
            ? "PROVIDER_ERROR"
            : result.error.code === "VALIDATION_ERROR"
              ? ErrorCodes.VALIDATION_ERROR
              : ErrorCodes.INTERNAL_ERROR;

      return sendError(
        ctx,
        result.error.status,
        errorCode,
        result.error.message
      );
    }

    return sendOk(ctx, {
      data: result.data,
    });
  },
};
