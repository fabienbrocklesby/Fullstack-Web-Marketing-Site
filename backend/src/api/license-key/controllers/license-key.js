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
        console.log("[license-key.find] customerId=", customerId);
        // For manyToOne relation Strapi creates a foreign key column (e.g. customer_id) or join table depending on DB; use nested filter form for safety
        const licenseKeys = await strapi.entityService.findMany(
          "api::license-key.license-key",
          {
            filters: { customer: { id: { $eq: customerId } } },
            populate: ["purchase"],
          },
        );

        console.log(
          "[license-key.find] fetched",
          licenseKeys.length,
          "keys for customer",
          customerId,
        );

        // Add a dynamic `isUsed` property for frontend compatibility
        const licenseKeysWithStatus = licenseKeys.map((key) => ({
          ...key,
          isUsed: key.status === "active",
        }));

        // Removed raw SQL diagnostic (caused sqlite column error) - rely on entityService abstraction

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
     * Creates a short activation code that is cryptographically bound to both the license key AND machine ID.
     */
    async generateActivationCode(ctx) {
      try {
        const { id } = ctx.params;
        const customerId = ctx.state.customer?.id;
        const { machineId } = ctx.request.body;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        if (!machineId) {
          return ctx.badRequest("Machine ID is required for secure activation");
        }

        // Normalize MAC address format
        const normalizeMacAddress = (mac) => {
          if (!mac) throw new Error("Machine ID is required");

          // Remove any non-hex characters and convert to lowercase
          const cleaned = mac.replace(/[^a-fA-F0-9]/g, "").toLowerCase();

          // Ensure it's 12 characters (6 bytes)
          if (cleaned.length !== 12) {
            throw new Error(
              "Invalid machine ID format. Expected 12 hex characters (MAC address).",
            );
          }

          // Format as aa:bb:cc:dd:ee:ff
          return cleaned.match(/.{2}/g).join(":");
        };

        const normalizedMachineId = normalizeMacAddress(machineId);

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

        // Generate a 4-byte random nonce for activation
        const activationNonce = crypto.randomBytes(4);
        const hashedNonce = crypto
          .createHash("sha256")
          .update(activationNonce)
          .digest("hex");

        // Create payload that includes both license key hash and machine ID hash
        // Structure: 4 bytes license key hash + 4 bytes machine ID hash + 4 bytes nonce = 12 bytes total
        const licenseKeyHash = crypto
          .createHash("sha256")
          .update(licenseKey.key)
          .digest();
        const machineIdHash = crypto
          .createHash("sha256")
          .update(normalizedMachineId)
          .digest();
        const payloadBuffer = Buffer.alloc(12);

        // First 4 bytes: truncated hash of license key (for verification)
        licenseKeyHash.copy(payloadBuffer, 0, 0, 4);

        // Next 4 bytes: truncated hash of machine ID (for machine binding)
        machineIdHash.copy(payloadBuffer, 4, 0, 4);

        // Last 4 bytes: activation nonce
        activationNonce.copy(payloadBuffer, 8);

        // Create XOR cipher using different parts of both hashes
        // Use bytes 4-7 from license key hash and bytes 8-15 from machine ID hash for XOR key
        const xorKey = Buffer.concat([
          licenseKeyHash.slice(4, 8), // 4 bytes from license hash
          machineIdHash.slice(8, 16), // 8 bytes from machine hash (but we only use 8 total)
        ]);

        // XOR encrypt the payload
        const encryptedPayload = Buffer.alloc(12);
        for (let i = 0; i < 12; i++) {
          encryptedPayload[i] = payloadBuffer[i] ^ xorKey[i];
        }

        // Encode to base58 for a compact, user-friendly string (~16 chars)
        const activationCode = bs58.encode(encryptedPayload);

        // ONLY update the database AFTER successful code generation
        await strapi.entityService.update("api::license-key.license-key", id, {
          data: {
            status: "active", // Mark as active only after successful code generation
            activationNonce: hashedNonce,
            machineId: normalizedMachineId, // Store the machine ID this license is bound to
            activatedAt: new Date().toISOString(),
          },
        });

        ctx.body = {
          activationCode,
          licenseKey: licenseKey.key,
          machineId: normalizedMachineId,
        };
      } catch (error) {
        console.error("Generate activation code error:", error);
        ctx.status = 500;
        ctx.body = {
          error: {
            message: error.message || "Failed to generate activation code",
          },
        };
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
        console.log("Deactivation request received:", {
          licenseId: id,
          customerId,
          deactivationCode: deactivationCode?.substring(0, 50) + "...",
        });

        if (!deactivationCode) {
          ctx.status = 400;
          ctx.body = {
            error: { message: "Deactivation code is required." },
          };
          return;
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
          ctx.status = 400;
          ctx.body = {
            error: {
              message: "This license is not currently active.",
            },
          };
          return;
        }

        if (!licenseKey.activationNonce) {
          return ctx.badRequest({
            error: {
              message:
                "This license was activated with a legacy method and cannot be deactivated this way.",
            },
          });
        }

        // Parse deactivation code (expecting format: {base64_payload}.{checksum})
        let deactivationPayload;
        try {
          console.log("Attempting to parse structured deactivation code...");
          const parts = deactivationCode.split(".");
          if (parts.length !== 2) {
            throw new Error(
              "Invalid deactivation code format - expected 2 parts separated by '.'",
            );
          }

          const [base64Payload, checksum] = parts;
          console.log("Deactivation code parts:", {
            base64Length: base64Payload.length,
            checksum,
          });

          // Decode the base64 payload
          const jsonPayload = Buffer.from(base64Payload, "base64").toString(
            "utf8",
          );
          console.log("Decoded JSON payload:", jsonPayload);
          deactivationPayload = JSON.parse(jsonPayload);

          // Verify required fields
          if (
            !deactivationPayload.license_key ||
            !deactivationPayload.machine_id ||
            !deactivationPayload.nonce ||
            !deactivationPayload.timestamp
          ) {
            throw new Error("Missing required fields in deactivation code");
          }

          // Verify the license key matches
          if (deactivationPayload.license_key !== licenseKey.key) {
            throw new Error("Deactivation code is for a different license key");
          }

          // Verify the machine ID matches (if stored)
          if (
            licenseKey.machineId &&
            deactivationPayload.machine_id !== licenseKey.machineId
          ) {
            throw new Error("Deactivation code is from a different machine");
          }

          // Verify timestamp is within reasonable window (48 hours)
          const now = Math.floor(Date.now() / 1000);
          const codeTimestamp = deactivationPayload.timestamp;
          const timeDiff = now - codeTimestamp;

          if (timeDiff > 48 * 60 * 60 || timeDiff < -60 * 60) {
            // 48 hours future, 1 hour past
            throw new Error(
              "Deactivation code has expired or has invalid timestamp",
            );
          }
        } catch (parseError) {
          // Fallback: try the old simple nonce format for backwards compatibility
          console.log(
            "Failed to parse structured deactivation code, trying legacy format:",
            parseError.message,
          );
          console.log("License key details:", {
            key: licenseKey.key,
            status: licenseKey.status,
            activationNonce: licenseKey.activationNonce ? "present" : "missing",
          });

          const receivedNonce = deactivationCode;
          const hashedNonceFromCode = crypto
            .createHash("sha256")
            .update(receivedNonce, "hex")
            .digest("hex");

          console.log("Nonce comparison:", {
            received: hashedNonceFromCode,
            stored: licenseKey.activationNonce,
          });

          if (hashedNonceFromCode !== licenseKey.activationNonce) {
            ctx.status = 400;
            ctx.body = {
              error: {
                message:
                  "Invalid deactivation code. Please make sure the code is correct and was generated for this license key.",
              },
            };
            return;
          }

          // Legacy format worked, proceed with deactivation
          await strapi.entityService.update(
            "api::license-key.license-key",
            id,
            {
              data: {
                status: "unused",
                activationNonce: null,
                activatedAt: null,
                machineId: null,
              },
            },
          );

          ctx.body = {
            message:
              "License deactivated successfully. You can now use it on another machine.",
          };
          return;
        }

        // For structured deactivation codes, verify the nonce matches
        const hashedNonceFromCode = crypto
          .createHash("sha256")
          .update(deactivationPayload.nonce, "hex")
          .digest("hex");

        if (hashedNonceFromCode !== licenseKey.activationNonce) {
          ctx.status = 400;
          ctx.body = {
            error: {
              message:
                "Invalid deactivation code nonce. Please make sure the code was generated from the correct activated license.",
            },
          };
          return;
        }

        // All validations passed, deactivate the license
        await strapi.entityService.update("api::license-key.license-key", id, {
          data: {
            status: "unused",
            activationNonce: null,
            activatedAt: null,
            machineId: null,
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
