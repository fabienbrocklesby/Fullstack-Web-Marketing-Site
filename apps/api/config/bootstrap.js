module.exports = async ({ strapi }) => {
  // Check if strapi is properly initialized
  if (!strapi || !strapi.query) {
    console.log("Strapi not fully initialized, skipping bootstrap");
    return;
  }

  try {
    // Verify ZeptoMail SMTP (non-fatal) if credentials present
    if (process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD) {
      try {
        const mailer = require("../src/utils/mailer");
        mailer.verify();
      } catch (e) {
        console.warn("SMTP verify skipped:", e.message);
      }
    } else {
      console.log("SMTP credentials missing; email disabled");
    }

    // Set up permissions for authenticated users
    const pluginStore = strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    // Get the authenticated role
    const authenticatedRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    if (authenticatedRole) {
      // Enable custom affiliate routes for authenticated users
      const permissions = await strapi
        .query("plugin::users-permissions.permission")
        .findMany({
          where: {
            role: authenticatedRole.id,
            action: {
              $in: [
                "api::affiliate.affiliate.find",
                "api::affiliate.affiliate.findOne",
                "api::affiliate.affiliate.create",
                "api::affiliate.affiliate.update",
                "api::affiliate.affiliate.delete",
              ],
            },
          },
        });

      // Enable all affiliate permissions for authenticated users
      const actionsToEnable = [
        "api::affiliate.affiliate.find",
        "api::affiliate.affiliate.findOne",
        "api::affiliate.affiliate.create",
        "api::affiliate.affiliate.update",
        "api::affiliate.affiliate.delete",
      ];

      for (const action of actionsToEnable) {
        const existingPermission = permissions.find((p) => p.action === action);
        if (existingPermission) {
          await strapi.query("plugin::users-permissions.permission").update({
            where: { id: existingPermission.id },
            data: { enabled: true },
          });
        } else {
          await strapi.query("plugin::users-permissions.permission").create({
            data: {
              action,
              subject: null,
              properties: {},
              conditions: [],
              role: authenticatedRole.id,
              enabled: true,
            },
          });
        }
      }

      console.log("✅ Affiliate permissions enabled for authenticated users");
    }

    // Run seeder if SEED_DATA environment variable is set
    if (process.env.SEED_DATA === "true") {
      console.log(
        "🌱 SEED_DATA environment variable detected, running seeder...",
      );

      try {
        const seeder = require("../test-data-seeder");

        // Small delay to ensure Strapi is fully loaded
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Make strapi globally available for the seeder
        global.strapi = strapi;

        await seeder.clearAllData();
        await seeder.createTestData();

        console.log("🎉 Bootstrap seeding completed!");
      } catch (error) {
        console.error("❌ Bootstrap seeding failed:", error);
      }
    }
  } catch (error) {
    console.error("Error in bootstrap:", error);
  }
};
