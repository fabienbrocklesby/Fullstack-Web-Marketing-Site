module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invites/issue",
      handler: "customer-invite.issue",
    },
    {
      method: "GET",
      path: "/invites/validate",
      handler: "customer-invite.validate",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/invites/redeem",
      handler: "customer-invite.redeem",
      config: { auth: false },
    },
  ],
};
