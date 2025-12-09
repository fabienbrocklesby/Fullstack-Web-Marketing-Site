module.exports = {
  routes: [
    {
      method: "POST",
      path: "/mailing-list-signups",
      handler: "mailing-list-signup.create",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
