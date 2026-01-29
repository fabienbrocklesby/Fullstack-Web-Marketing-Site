/**
 * AI API Routes (Portal AI API - Stage 1)
 *
 * Defines routes for AI-related endpoints.
 * All routes are mounted under /api by Strapi, so paths become /api/v1/ai/...
 */

module.exports = {
  routes: [
    // =========================================================================
    // Stage 1: AI Token Minting
    // =========================================================================

    /**
     * Mint an AI token for the desktop app.
     * Requires customer auth + active entitlement.
     * Returns a short-lived token used for AI-specific endpoints.
     *
     * Uses customer-auth-ai middleware (not customer-auth) to ensure
     * auth failures return portal envelope, not Strapi defaults.
     */
    {
      method: "POST",
      path: "/v1/ai/token",
      handler: "ai.mintToken",
      config: {
        auth: false,
        middlewares: ["global::customer-auth-ai", "global::license-rate-limit"],
      },
    },

    // =========================================================================
    // Stage 1: Settings Assistant
    // =========================================================================

    /**
     * Settings Assistant endpoint.
     * Requires AI token (not customer auth).
     * Proxies to OpenAI with strict validation and size limits.
     */
    {
      method: "POST",
      path: "/v1/ai/settings-assistant",
      handler: "ai.settingsAssistant",
      config: {
        auth: false,
        middlewares: ["global::ai-auth", "global::ai-rate-limit"],
      },
    },

    // =========================================================================
    // Stage 2: Engrave Assistant (Image-based)
    // =========================================================================

    /**
     * Engrave Assistant endpoint.
     * Requires AI token (not customer auth).
     * Accepts multipart/form-data with image + payload JSON string.
     */
    {
      method: "POST",
      path: "/v1/ai/engrave-assistant",
      handler: "ai.engraveAssistant",
      config: {
        auth: false,
        middlewares: ["global::ai-auth", "global::ai-rate-limit"],
      },
    },
  ],
};
