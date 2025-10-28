module.exports = async ({ strapi }) => {
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

    // Set up permissions for public and authenticated users
    // Get the public role
    const publicRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });

    console.log("🔍 Found public role:", publicRole ? publicRole.id : "NOT FOUND");

    if (publicRole) {
      // Enable blogposts find and findOne for public users
      const publicActionsToEnable = [
        "api::blogpost.blogpost.find",
        "api::blogpost.blogpost.findOne",
      ];

      console.log("🔍 Attempting to enable blogpost permissions for public...");

      for (const action of publicActionsToEnable) {
        const existingPermission = await strapi
          .query("plugin::users-permissions.permission")
          .findOne({
            where: {
              role: publicRole.id,
              action: action,
            },
          });

        if (existingPermission) {
          await strapi.query("plugin::users-permissions.permission").update({
            where: { id: existingPermission.id },
            data: { enabled: true },
          });
          console.log(`✅ Updated blogpost permission: ${action}`);
        } else {
          await strapi.query("plugin::users-permissions.permission").create({
            data: {
              action,
              subject: null,
              properties: {},
              conditions: [],
              role: publicRole.id,
              enabled: true,
            },
          });
          console.log(`✅ Created blogpost permission: ${action}`);
        }
      }

      console.log("✅ Blogpost permissions enabled for public users");
    }

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
