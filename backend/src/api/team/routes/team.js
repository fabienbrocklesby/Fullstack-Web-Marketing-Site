module.exports = {
  routes: [
    {
      method: "POST",
      path: "/team/register",
      handler: "team.register",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/team/login",
      handler: "team.login",
      config: {
        auth: false,
      },
    },
  ],
};
