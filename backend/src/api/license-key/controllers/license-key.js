const { createCoreController } = require("@strapi/strapi").factories;
const { sendRetired } = require("../../../utils/api-responses");

/**
 * License Key Controller
 * 
 * STAGE 5.5 CUTOVER: All legacy MAC-based activation endpoints are RETIRED.
 * All activation now uses the unified Stage 4/5 device-based system:
 *   - POST /api/device/register
 *   - POST /api/licence/activate
 *   - POST /api/licence/refresh
 *   - POST /api/licence/deactivate
 * 
 * These retired endpoints return 410 Gone to signal clients to upgrade.
 */
module.exports = createCoreController(
  "api::license-key.license-key",
  ({ strapi }) => ({
    // =========================================================================
    // RETIRED ENDPOINTS - Return 410 Gone
    // =========================================================================

    async findLegacyRetired(ctx) {
      strapi.log.warn(`[RETIRED] GET /api/license-keys called by customer ${ctx.state.customer?.id || "unknown"}`);
      return sendRetired(
        ctx,
        "MAC-based activation has been retired. Please use the new device-based activation system via /api/customers/me/entitlements and /api/licence/activate.",
        { guide: "Your licenses have been migrated to entitlements. Use the dashboard to activate on your devices." }
      );
    },

    async findOneLegacyRetired(ctx) {
      strapi.log.warn(`[RETIRED] GET /api/license-keys/:id called by customer ${ctx.state.customer?.id || "unknown"}`);
      return sendRetired(
        ctx,
        "MAC-based activation has been retired. Please use the new device-based activation system.",
        { guide: "Your licenses have been migrated to entitlements." }
      );
    },

    async generateActivationCodeLegacyRetired(ctx) {
      strapi.log.warn(`[RETIRED] POST /api/license-keys/:id/generate-activation-code called by customer ${ctx.state.customer?.id || "unknown"}`);
      return sendRetired(
        ctx,
        "MAC-based activation has been retired. Please use the new device-based activation: 1) Register device via /api/device/register, 2) Activate via /api/licence/activate.",
        { guide: "Your licenses have been migrated to entitlements. Update your desktop app to use the new activation system." }
      );
    },

    async deactivateWithCodeLegacyRetired(ctx) {
      strapi.log.warn(`[RETIRED] POST /api/license-keys/:id/deactivate-with-code called by customer ${ctx.state.customer?.id || "unknown"}`);
      return sendRetired(
        ctx,
        "MAC-based deactivation has been retired. Please use /api/licence/deactivate with your deviceId.",
        { guide: "Your licenses have been migrated to entitlements. Update your desktop app to use the new deactivation system." }
      );
    },

    // DEPRECATED legacy methods kept for backwards compatibility
    async activate(ctx) {
      return sendRetired(ctx, "Legacy endpoint retired. Use /api/licence/activate.");
    },

    async deactivate(ctx) {
      return sendRetired(ctx, "Legacy endpoint retired. Use /api/licence/deactivate.");
    },
  }),
);
