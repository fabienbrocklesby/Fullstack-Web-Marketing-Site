module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enquiries",
      handler: "enquiry.create",
      config: { auth: false },
    },
  ],
};
