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
      path: "/license-keys/:id/activate",
      handler: "license-key.activate",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/license-keys/:id/deactivate",
      handler: "license-key.deactivate",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
  ],
};
