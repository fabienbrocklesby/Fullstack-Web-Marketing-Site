module.exports = {
  routes: [
    {
      method: "POST",
      path: "/license/activate",
      handler: "license.activate",
      config: {
        auth: false, // Public endpoint
      },
    },
    {
      method: "POST",
      path: "/license/deactivate",
      handler: "license.deactivate",
      config: {
        auth: false, // Public endpoint
      },
    },
  ],
};
