const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

module.exports = {
  // POST /license/activate
  async activate(ctx) {
    try {
      const { licenceKey, machineId } = ctx.request.body;

      if (!licenceKey || !machineId) {
        ctx.status = 400;
        ctx.body = {
          error: "Missing required fields: licenceKey and machineId",
        };
        return;
      }

      // Find the license key
      const licenseKeys = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: { key: licenceKey },
        },
      );

      if (licenseKeys.length === 0) {
        ctx.status = 404;
        ctx.body = {
          error: "License key not found",
        };
        return;
      }

      const license = licenseKeys[0];

      // Check if license is already active
      if (license.status === "active") {
        ctx.status = 400;
        ctx.body = {
          error: "License is already active",
        };
        return;
      }

      // Check trial restrictions
      if (license.typ === "trial" && license.status !== "unused") {
        ctx.status = 400;
        ctx.body = {
          error: "Trial license can only be activated once",
        };
        return;
      }

      // Generate new JWT ID
      const jti = uuidv4();

      // Hash the machine ID for storage
      const hashedMachineId = crypto
        .createHash("sha256")
        .update(machineId)
        .digest("hex");

      // Update license status
      const updateData = {
        status: "active",
        jti: jti,
        machineId: hashedMachineId,
        isUsed: true, // Keep for backward compatibility
      };

      // Set trial start time for trial licenses
      if (license.typ === "trial") {
        updateData.trialStart = new Date();
      }

      const updatedLicense = await strapi.entityService.update(
        "api::license-key.license-key",
        license.id,
        {
          data: updateData,
        },
      );

      // Create JWT payload
      const payload = {
        iss: process.env.SITE_URL || "https://localhost:4321",
        sub: license.id.toString(),
        jti: jti,
        typ: license.typ,
        machineId: hashedMachineId,
        iat: Math.floor(Date.now() / 1000),
      };

      // Add trial start for trial licenses
      if (license.typ === "trial" && updateData.trialStart) {
        payload.trialStart = Math.floor(updateData.trialStart.getTime() / 1000);
      }

      // Get private key from environment
      const privateKey = process.env.JWT_PRIVATE_KEY;
      if (!privateKey) {
        console.error("JWT_PRIVATE_KEY not found in environment variables");
        ctx.status = 500;
        ctx.body = {
          error: "Server configuration error",
        };
        return;
      }

      // Sign JWT with RS256
      const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
      });

      console.log(
        `✅ License activated: ${licenceKey} for machine: ${machineId.substring(0, 8)}...`,
      );

      ctx.body = {
        token: token,
      };
    } catch (error) {
      console.error("License activation error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to activate license",
      };
    }
  },

  // POST /license/deactivate
  async deactivate(ctx) {
    try {
      const { licenceKey, jti, machineId } = ctx.request.body;

      if (!licenceKey || !jti || !machineId) {
        ctx.status = 400;
        ctx.body = {
          error: "Missing required fields: licenceKey, jti, and machineId",
        };
        return;
      }

      // Hash the machine ID for comparison
      const hashedMachineId = crypto
        .createHash("sha256")
        .update(machineId)
        .digest("hex");

      // Find the license key with matching criteria
      const licenseKeys = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: {
            key: licenceKey,
            status: "active",
            jti: jti,
            machineId: hashedMachineId,
          },
        },
      );

      if (licenseKeys.length === 0) {
        ctx.status = 404;
        ctx.body = {
          error: "No matching active license found",
        };
        return;
      }

      const license = licenseKeys[0];

      // Deactivate the license
      await strapi.entityService.update(
        "api::license-key.license-key",
        license.id,
        {
          data: {
            status: "unused",
            jti: null,
            machineId: null,
            isUsed: false, // Keep for backward compatibility
          },
        },
      );

      console.log(
        `✅ License deactivated: ${licenceKey} from machine: ${machineId.substring(0, 8)}...`,
      );

      ctx.body = {
        success: true,
      };
    } catch (error) {
      console.error("License deactivation error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to deactivate license",
      };
    }
  },
};
