module.exports = {
  routes: [
    {
      method: "GET",
      path: "/my-purchases",
      handler: "purchase.find",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/my-purchases/:id",
      handler: "purchase.findOne",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
