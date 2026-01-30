module.exports = {
  routes: [
    // Rate limited to prevent brute force registration
    {
      method: "POST",
      path: "/customers/register",
      handler: "customer.register",
      config: {
        auth: false,
        middlewares: ["global::auth-rate-limit"],
      },
    },
    // Rate limited to prevent brute force login
    {
      method: "POST",
      path: "/customers/login",
      handler: "customer.login",
      config: {
        auth: false,
        middlewares: ["global::auth-rate-limit"],
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
    // Get customer entitlements (legacy path)
    {
      method: "GET",
      path: "/customers/entitlements",
      handler: "customer.entitlements",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Get customer entitlements (canonical path under /me)
    {
      method: "GET",
      path: "/customers/me/entitlements",
      handler: "customer.entitlements",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Get primary entitlement for subscription UI card
    {
      method: "GET",
      path: "/customers/me/entitlement",
      handler: "customer.primaryEntitlement",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Get customer's registered devices (Stage 4/5)
    {
      method: "GET",
      path: "/customers/me/devices",
      handler: "customer.devices",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Create Stripe billing portal session (alias for customer convenience)
    {
      method: "POST",
      path: "/customers/billing-portal",
      handler: "customer.billingPortal",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
  ],
};
