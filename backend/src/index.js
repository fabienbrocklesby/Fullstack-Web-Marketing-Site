module.exports = {
  /**
           // Enable custom affiliate and purchase routes for authenticated users
        const actionsToEnable = [
          'api::affiliate.affiliate.find',
          'api::affiliate.affiliate.findOne', 
          'api::affiliate.affiliate.create',
          'api::affiliate.affiliate.update',
          'api::affiliate.affiliate.delete',
          'api::purchase.purchase.find',
          'api::purchase.purchase.findOne',
          'api::custom.custom.getAffiliateStats'
        ];hronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log("🚀 Strapi has fully loaded");

    // Set up permissions for authenticated users
    try {
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } });

      if (authenticatedRole) {
        console.log("Found authenticated role:", authenticatedRole.id);

        // Enable custom affiliate and purchase routes for authenticated users
        const actionsToEnable = [
          "api::affiliate.affiliate.find",
          "api::affiliate.affiliate.findOne",
          "api::affiliate.affiliate.create",
          "api::affiliate.affiliate.update",
          "api::affiliate.affiliate.delete",
          "api::purchase.purchase.find",
          "api::purchase.purchase.findOne",
        ];

        for (const action of actionsToEnable) {
          const existingPermission = await strapi
            .query("plugin::users-permissions.permission")
            .findOne({
              where: {
                role: authenticatedRole.id,
                action: action,
              },
            });

          if (existingPermission) {
            await strapi.query("plugin::users-permissions.permission").update({
              where: { id: existingPermission.id },
              data: { enabled: true },
            });
            console.log(`✅ Updated permission: ${action}`);
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
            console.log(`✅ Created permission: ${action}`);
          }
        }

        console.log(
          "✅ Affiliate and purchase permissions enabled for authenticated users",
        );
      } else {
        console.log("❌ Could not find authenticated role");
      }
    } catch (error) {
      console.error("❌ Error setting up permissions:", error);
    }

    // Auto-create test data in development (disabled to prevent duplicate data errors)
    // if (process.env.NODE_ENV === "development") {
    //   try {
    //     const testDataSeeder = require("../test-data-seeder");
    //     await testDataSeeder.createTestData();
    //   } catch (error) {
    //     console.log("Test data seeder not available or failed:", error.message);
    //   }
    // }
  },
};
