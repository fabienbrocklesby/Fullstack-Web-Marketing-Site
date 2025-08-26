module.exports = {
  routes: [
    {
      method: "POST",
      path: "/license/activate",
      handler: "license-portal.activate",
      config: {
        auth: false, // Public endpoint
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/license/deactivate",
      handler: "license-portal.deactivate",
      config: {
        auth: false, // Public endpoint
        policies: [],
        middlewares: [],
      },
    },
  ],
};
