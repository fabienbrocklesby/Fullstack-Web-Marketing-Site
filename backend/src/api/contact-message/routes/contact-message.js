module.exports = {
  routes: [
    {
      method: "POST",
      path: "/contact-messages",
      handler: "contact-message.create",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
