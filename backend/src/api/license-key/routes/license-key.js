module.exports = {
  routes: [
    {
      method: "GET",
      path: "/license-keys",
      handler: "license-key.find",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "GET",
      path: "/license-keys/:id",
      handler: "license-key.findOne",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/license-keys/:id/generate-activation-code",
      handler: "license-key.generateActivationCode",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/license-keys/:id/deactivate-with-code",
      handler: "license-key.deactivateWithCode",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
        policies: [],
        bodyParser: true,
      },
    },
  ],
};
