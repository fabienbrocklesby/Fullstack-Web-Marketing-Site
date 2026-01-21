module.exports = {
  routes: [
    // =========================================================================
    // LEGACY MAC-BASED ENDPOINTS - RETIRED (Stage 5.5 Cutover)
    // These endpoints now return 410 Gone. All activation uses Stage 4/5.
    // =========================================================================
    {
      method: "GET",
      path: "/license-keys",
      handler: "license-key.findLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "GET",
      path: "/license-keys/:id",
      handler: "license-key.findOneLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/license-keys/:id/generate-activation-code",
      handler: "license-key.generateActivationCodeLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/license-keys/:id/deactivate-with-code",
      handler: "license-key.deactivateWithCodeLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
        policies: [],
        bodyParser: true,
      },
    },
  ],
};
