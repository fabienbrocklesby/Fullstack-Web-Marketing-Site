const { createCoreController } = require("@strapi/strapi").factories;
const crypto = require("crypto");

module.exports = createCoreController(
  "api::license-key.license-key",
  ({ strapi }) => ({
    // Get customer's license keys
    async find(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const licenseKeys = await strapi.entityService.findMany(
          "api::license-key.license-key",
          {
            filters: { customer: customerId },
            populate: ["purchase"],
          },
        );

        ctx.body = { licenseKeys };
      } catch (error) {
        console.error("Get license keys error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to get license keys" };
      }
    },

    // Get specific license key
    async findOne(ctx) {
      try {
        const { id } = ctx.params;
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const licenseKey = await strapi.entityService.findOne(
          "api::license-key.license-key",
          id,
          {
            populate: ["purchase", "customer"],
          },
        );

        if (!licenseKey) {
          return ctx.notFound("License key not found");
        }

        // Check if customer owns this license key
        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only access your own license keys");
        }

        ctx.body = { licenseKey };
      } catch (error) {
        console.error("Get license key error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to get license key" };
      }
    },

    // Activate license key
    async activate(ctx) {
      try {
        const { id } = ctx.params;
        const customerId = ctx.state.customer?.id;
        const { deviceInfo } = ctx.request.body;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const licenseKey = await strapi.entityService.findOne(
          "api::license-key.license-key",
          id,
          {
            populate: ["customer"],
          },
        );

        if (!licenseKey) {
          return ctx.notFound("License key not found");
        }

        // Check if customer owns this license key
        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only activate your own license keys");
        }

        // Check if license key is already used on maximum devices
        if (licenseKey.currentActivations >= licenseKey.maxActivations) {
          return ctx.badRequest(
            `License key has reached maximum activations (${licenseKey.maxActivations}). Please deactivate from another device first.`,
          );
        }

        // Check if license key is active
        if (!licenseKey.isActive) {
          return ctx.badRequest("License key is not active");
        }

        // Check if license key has expired
        if (
          licenseKey.expiresAt &&
          new Date() > new Date(licenseKey.expiresAt)
        ) {
          return ctx.badRequest("License key has expired");
        }

        // Create device fingerprint for better tracking
        const deviceFingerprint = deviceInfo
          ? {
              userAgent: deviceInfo.userAgent || "",
              platform: deviceInfo.platform || "",
              timestamp: deviceInfo.timestamp || new Date().toISOString(),
              activationId: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            }
          : null;

        // Activate the license key
        const updatedLicenseKey = await strapi.entityService.update(
          "api::license-key.license-key",
          id,
          {
            data: {
              isUsed: true,
              deviceInfo: deviceFingerprint,
              activatedAt: new Date(),
              currentActivations: licenseKey.currentActivations + 1,
            },
          },
        );

        ctx.body = {
          licenseKey: updatedLicenseKey,
          message: "License key activated successfully",
          deviceFingerprint: deviceFingerprint?.activationId,
        };
      } catch (error) {
        console.error("Activate license key error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to activate license key" };
      }
    },

    // Deactivate license key (if allowed)
    async deactivate(ctx) {
      try {
        const { id } = ctx.params;
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const licenseKey = await strapi.entityService.findOne(
          "api::license-key.license-key",
          id,
          {
            populate: ["customer"],
          },
        );

        if (!licenseKey) {
          return ctx.notFound("License key not found");
        }

        // Check if customer owns this license key
        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only deactivate your own license keys");
        }

        // Check if license key is used
        if (!licenseKey.isUsed) {
          return ctx.badRequest("License key is not activated");
        }

        // Deactivate the license key
        const updatedLicenseKey = await strapi.entityService.update(
          "api::license-key.license-key",
          id,
          {
            data: {
              isUsed: false,
              deviceInfo: null,
              activatedAt: null,
              currentActivations: Math.max(
                0,
                licenseKey.currentActivations - 1,
              ),
            },
          },
        );

        ctx.body = {
          licenseKey: updatedLicenseKey,
          message: "License key deactivated successfully",
        };
      } catch (error) {
        console.error("Deactivate license key error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to deactivate license key" };
      }
    },

    // Generate a new license key (helper function)
    generateLicenseKey(productName, customerId) {
      // Generate a unique license key
      const timestamp = Date.now().toString(36);
      const randomString = crypto.randomBytes(8).toString("hex").toUpperCase();
      const productCode = productName.substring(0, 3).toUpperCase();
      const customerCode = customerId.toString().substring(0, 4);

      return `${productCode}-${customerCode}-${timestamp}-${randomString}`;
    },
  }),
);
