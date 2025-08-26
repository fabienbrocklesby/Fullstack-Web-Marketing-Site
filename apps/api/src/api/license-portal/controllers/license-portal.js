const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

module.exports = {
  /**
   * Activate a license key
   * POST /license/activate
   * Body: { licenceKey, machineId }
   */
  async activate(ctx) {
    try {
      const { licenceKey, machineId } = ctx.request.body;

      // Validate input
      if (!licenceKey || !machineId) {
        ctx.status = 400;
        ctx.body = { error: "licenceKey and machineId are required" };
        return;
      }

      // Find the license by key
      const license = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: { key: licenceKey },
          limit: 1,
        },
      );

      if (!license || license.length === 0) {
        ctx.status = 404;
        ctx.body = { error: "License key not found" };
        return;
      }

      const licenseRecord = license[0];

      // Check if license is already active
      if (licenseRecord.status === "active") {
        ctx.status = 400;
        ctx.body = { error: "License is already active" };
        return;
      }

      // For trial licenses, only allow one-time activation
      if (licenseRecord.typ === "trial" && licenseRecord.status !== "unused") {
        ctx.status = 400;
        ctx.body = { error: "Trial licenses can only be activated once" };
        return;
      }

      // Generate new activation
      const jti = uuidv4();
      const now = new Date();
      const trialStart = licenseRecord.typ === "trial" ? now : undefined;

      // Update license record
      const updatedLicense = await strapi.entityService.update(
        "api::license-key.license-key",
        licenseRecord.id,
        {
          data: {
            status: "active",
            jti,
            machineId,
            trialStart,
            activatedAt: now,
            isUsed: true, // Legacy compatibility
          },
        },
      );

      // Create JWT payload
      const payload = {
        iss: process.env.JWT_ISSUER || `https://${ctx.request.host}`,
        sub: licenseRecord.id.toString(),
        jti,
        typ: licenseRecord.typ,
        machineId,
        iat: Math.floor(now.getTime() / 1000),
      };

      // Add trialStart for trial licenses
      if (licenseRecord.typ === "trial") {
        payload.trialStart = Math.floor(now.getTime() / 1000);
      }

      // Get private key from environment
      const privateKey = process.env.JWT_PRIVATE_KEY;
      if (!privateKey) {
        console.error("JWT_PRIVATE_KEY not found in environment");
        ctx.status = 500;
        ctx.body = { error: "JWT private key not configured" };
        return;
      }

      console.log("Private key found, length:", privateKey.length);

      // Sign JWT with RS256
      const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        noTimestamp: true, // We set iat manually
      });

      ctx.status = 200;
      ctx.body = { token };
    } catch (error) {
      console.error("License activation error:", error);
      console.error("Error stack:", error.stack);
      ctx.status = 500;
      ctx.body = { error: "Internal server error", details: error.message };
    }
  },

  /**
   * Deactivate a license key
   * POST /license/deactivate
   * Body: { licenceKey, jti, machineId }
   */
  async deactivate(ctx) {
    try {
      const { licenceKey, jti, machineId } = ctx.request.body;

      // Validate input
      if (!licenceKey || !jti || !machineId) {
        ctx.status = 400;
        ctx.body = { error: "licenceKey, jti, and machineId are required" };
        return;
      }

      // Find the license by key, jti, and machineId
      const license = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: {
            key: licenceKey,
            jti,
            machineId,
            status: "active",
          },
          limit: 1,
        },
      );

      if (!license || license.length === 0) {
        ctx.status = 404;
        ctx.body = {
          error: "Active license not found with provided credentials",
        };
        return;
      }

      const licenseRecord = license[0];

      // Deactivate the license
      await strapi.entityService.update(
        "api::license-key.license-key",
        licenseRecord.id,
        {
          data: {
            status: "unused",
            jti: null,
            machineId: null,
            activatedAt: null,
            isUsed: false, // Legacy compatibility
          },
        },
      );

      ctx.status = 200;
      ctx.body = { success: true };
    } catch (error) {
      console.error("License deactivation error:", error);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },
};
