const { createCoreController } = require("@strapi/strapi").factories;
const crypto = require("crypto");
const bs58 = require("bs58").default;

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

        // Add a dynamic `isUsed` property for frontend compatibility
        const licenseKeysWithStatus = licenseKeys.map((key) => ({
          ...key,
          isUsed: key.status === "active",
        }));

        ctx.body = { licenseKeys: licenseKeysWithStatus };
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

        // Add a dynamic `isUsed` property for frontend compatibility
        const licenseKeyWithStatus = {
          ...licenseKey,
          isUsed: licenseKey.status === "active",
        };

        ctx.body = { licenseKey: licenseKeyWithStatus };
      } catch (error) {
        console.error("Get license key error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to get license key" };
      }
    },

    // Activate license key - DEPRECATED
    async activate(ctx) {
      return ctx.badRequest(
        "This endpoint is deprecated. Please use the offline activation flow.",
      );
    },

    // Deactivate license key - DEPRECATED
    async deactivate(ctx) {
      return ctx.badRequest(
        "This endpoint is deprecated. Please use the offline deactivation flow.",
      );
    },

    /**
     * Generates a single-use, encrypted activation code for a license key.
     * This "locks" the key until it is deactivated.
     */
    async generateActivationCode(ctx) {
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

        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only activate your own license keys");
        }

        if (licenseKey.status !== "unused") {
          return ctx.badRequest(
            "License key is already active or pending activation. Please deactivate it first.",
          );
        }

        // Create a unique, single-use token for this activation
        const activationNonce = crypto.randomBytes(16).toString("hex");
        const hashedNonce = crypto
          .createHash("sha256")
          .update(activationNonce)
          .digest("hex");

        // --- Create a compact BINARY payload FIRST (before database update) ---
        // We need 2 bytes for product ID, 8 bytes for expiry, 16 for nonce. Total 26 bytes.
        const payloadBuffer = Buffer.alloc(26);

        // 1. Product ID (2 bytes, UInt16BE)
        // Using purchase ID as a stand-in. A more robust system might map product names to IDs.
        const productId = licenseKey.purchase?.id || 0;
        payloadBuffer.writeUInt16BE(productId, 0);

        // 2. Expiry Timestamp (8 bytes, BigUInt64BE)
        // For offline activation codes, set to "never expires" (year 2100)
        const neverExpires = new Date("2100-01-01").getTime();
        const expiresAt = licenseKey.expiresAt
          ? new Date(licenseKey.expiresAt).getTime()
          : neverExpires;
        payloadBuffer.writeBigUInt64BE(BigInt(expiresAt), 2);

        // 3. Activation Nonce (16 bytes)
        const nonceBuffer = Buffer.from(activationNonce, "hex");
        nonceBuffer.copy(payloadBuffer, 10); // 2 (product) + 8 (expiry) = 10

        // Encrypt the binary payload
        const algorithm = "aes-256-cbc";
        const key = crypto.createHash("sha256").update(licenseKey.key).digest();
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const encryptedPayload = Buffer.concat([
          cipher.update(payloadBuffer),
          cipher.final(),
        ]);

        // Combine IV and encrypted payload, then encode with bs58 for a compact string
        const finalBuffer = Buffer.concat([iv, encryptedPayload]);
        const activationCode = bs58.encode(finalBuffer);

        // ONLY update the database AFTER successful code generation
        await strapi.entityService.update("api::license-key.license-key", id, {
          data: {
            status: "active", // Mark as active only after successful code generation
            activationNonce: hashedNonce,
            activatedAt: new Date().toISOString(),
          },
        });

        ctx.body = {
          activationCode,
          licenseKey: licenseKey.key,
          // Note: deactivationCode (activationNonce) is stored securely on the server
          // and will be provided by the offline app when deactivating
        };
      } catch (error) {
        console.error("Generate activation code error:", error);
        ctx.status = 500;
        ctx.body = { error: { message: "Failed to generate activation code" } };
      }
    },

    /**
     * Deactivates a license key using a deactivation code from an offline app.
     */
    async deactivateWithCode(ctx) {
      try {
        const { id } = ctx.params;
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const { deactivationCode } = ctx.request.body;
        if (!deactivationCode) {
          return ctx.badRequest({
            error: { message: "Deactivation code is required." },
          });
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

        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only deactivate your own license keys");
        }

        if (licenseKey.status !== "active") {
          return ctx.badRequest("This license is not currently active.");
        }

        if (!licenseKey.activationNonce) {
          return ctx.badRequest({
            error: {
              message:
                "This license was activated with a legacy method and cannot be deactivated this way.",
            },
          });
        }

        const receivedNonce = deactivationCode;
        const hashedNonceFromCode = crypto
          .createHash("sha256")
          .update(receivedNonce)
          .digest("hex");

        if (hashedNonceFromCode !== licenseKey.activationNonce) {
          return ctx.badRequest({
            error: {
              message:
                "Invalid deactivation code. Please make sure the code is correct and was generated for this license key.",
            },
          });
        }

        await strapi.entityService.update("api::license-key.license-key", id, {
          data: {
            status: "unused",
            activationNonce: null,
            activatedAt: null,
          },
        });

        ctx.body = {
          message:
            "License deactivated successfully. You can now use it on another machine.",
        };
      } catch (error) {
        console.error("Deactivation error:", error);
        ctx.status = 500;
        ctx.body = {
          error: {
            message: "An unexpected server error occurred during deactivation.",
          },
        };
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

    // Generate offline activation code
    async generateOfflineCode(ctx) {
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

        if (licenseKey.customer.id !== customerId) {
          return ctx.forbidden("You can only access your own license keys");
        }

        // Create the payload for offline activation
        const payload = {
          key: licenseKey.key,
          type: licenseKey.type,
          plan: licenseKey.purchase?.planName || "N/A",
          expiresAt: licenseKey.expiresAt,
          activatedAt: new Date().toISOString(),
          // Add any other relevant details for the offline app
          features: licenseKey.features || [],
        };

        // Encrypt the payload using the license key as the secret
        const algorithm = "aes-256-cbc";
        const key = crypto.createHash("sha256").update(licenseKey.key).digest();
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
        encrypted += cipher.final("hex");

        const activationCode = `${iv.toString("hex")}:${encrypted}`;

        ctx.body = { activationCode };
      } catch (error) {
        console.error("Generate offline code error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to generate offline activation code" };
      }
    },
  }),
);
