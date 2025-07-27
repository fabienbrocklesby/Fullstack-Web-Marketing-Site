#!/usr/bin/env node

const path = require("path");

async function resetLicense() {
  const backendPath = path.join(__dirname, "backend");
  process.chdir(backendPath);
  process.env.NODE_ENV = process.env.NODE_ENV || "development";

  const strapi = require("@strapi/strapi");
  const app = await strapi().load();
  global.strapi = app;

  try {
    // Reset license 10 to unused
    await app.entityService.update("api::license-key.license-key", 10, {
      data: {
        status: "unused",
        activationNonce: null,
        activatedAt: null,
      },
    });

    console.log("✅ License ID 10 has been reset to 'unused'.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  await app.destroy();
  process.exit(0);
}

resetLicense();
