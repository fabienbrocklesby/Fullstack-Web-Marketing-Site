module.exports = {
  routes: [
    {
      method: "GET",
      path: "/my-affiliates",
      handler: "affiliate.find",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: ["global::auth-debug"],
      },
    },
    {
      method: "GET",
      path: "/my-affiliates/:id",
      handler: "affiliate.findOne",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/my-affiliates",
      handler: "affiliate.create",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/my-affiliates/:id",
      handler: "affiliate.update",
      config: {
        auth: {
          strategies: ["users-permissions"],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "DELETE",
      path: "/my-affiliates/:id",
      handler: "affiliate.delete",
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
