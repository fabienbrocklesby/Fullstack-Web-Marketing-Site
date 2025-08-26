module.exports = {
  routes: [
    {
      method: "POST",
      path: "/customers/register",
      handler: "customer.register",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/customers/login",
      handler: "customer.login",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/customers/me",
      handler: "customer.me",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "PUT",
      path: "/customers/profile",
      handler: "customer.updateProfile",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "PUT",
      path: "/customers/password",
      handler: "customer.changePassword",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
  ],
};
