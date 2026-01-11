/**
 * DEPRECATED: These routes are disabled to prevent route shadowing.
 * The canonical license activation/deactivation endpoints are now in:
 *   backend/src/api/custom/routes/custom.js
 *
 * They use the custom.licenseActivate and custom.licenseDeactivate handlers
 * with proper rate limiting middleware.
 *
 * This file is kept for reference only. Do not re-enable these routes.
 */
module.exports = {
  routes: [
    // DISABLED - Route shadowing with custom/routes/custom.js
    // {
    //   method: "POST",
    //   path: "/license/activate",
    //   handler: "license.activate",
    //   config: { auth: false },
    // },
    // {
    //   method: "POST",
    //   path: "/license/deactivate",
    //   handler: "license.deactivate",
    //   config: { auth: false },
    // },
  ],
};
