module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invites/issue",
      handler: "customer-invite.issue",
      config: { policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/invites/validate",
      handler: "customer-invite.validate",
      config: { auth: false, middlewares: ["global::invite-rate-limit"] },
    },
    {
      method: "POST",
      path: "/invites/redeem",
      handler: "customer-invite.redeem",
      config: { auth: false, middlewares: ["global::invite-rate-limit"] },
    },
  ],
};
