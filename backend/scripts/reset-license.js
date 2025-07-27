const strapi = require("@strapi/strapi");

(async () => {
  let app;
  try {
    console.log("Starting license reset script...");

    // Initialize Strapi. This script must be run from the `backend` directory.
    app = await strapi().load();

    const licenseIdToReset = parseInt(process.argv[2]) || 10; // Default to 10

    console.log(`Attempting to reset license ID: ${licenseIdToReset}`);

    const license = await app.entityService.findOne(
      "api::license-key.license-key",
      licenseIdToReset,
    );

    if (!license) {
      console.error(`Error: License with ID ${licenseIdToReset} not found.`);
      process.exit(1);
    }

    console.log(
      `Found license. Current status: '${license.status}'. Resetting...`,
    );

    await app.entityService.update(
      "api::license-key.license-key",
      licenseIdToReset,
      {
        data: {
          status: "unused",
          activationNonce: null,
          activatedAt: null,
          deactivatedAt: null,
          owner: null,
        },
      },
    );

    console.log(
      `✅ License ID ${licenseIdToReset} has been successfully reset to 'unused'.`,
    );
    process.exit(0);
  } catch (err) {
    console.error("An error occurred during the license reset script:", err);
    process.exit(1);
  } finally {
    if (app) {
      await app.destroy();
    }
  }
})();
