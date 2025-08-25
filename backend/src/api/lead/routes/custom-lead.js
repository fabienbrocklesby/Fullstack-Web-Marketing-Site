module.exports = {
  routes: [
    {
      method: "POST",
      path: "/leads/:id/claim",
      handler: "lead.claim",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/crm/zoho-email",
      handler: "lead.addEmailCommunication",
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
  ],
};
