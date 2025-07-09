module.exports = {
  routes: [
    {
      method: "POST",
      path: "/affiliate-checkout",
      handler: "custom.affiliateCheckout",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/stripe/webhook",
      handler: "custom.stripeWebhook",
      config: {
        auth: false,
      },
    },
    // Development-only endpoint to manually trigger purchase creation
    {
      method: "POST",
      path: "/dev/create-purchase",
      handler: "custom.devCreatePurchase",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/customer-checkout",
      handler: "custom.customerCheckout",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    {
      method: "POST",
      path: "/process-customer-purchase",
      handler: "custom.processCustomerPurchase",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
  ],
};
