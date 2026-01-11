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
    // LOCKED: Blocked in production via dev-only middleware
    {
      method: "POST",
      path: "/dev/create-purchase",
      handler: "custom.devCreatePurchase",
      config: {
        auth: false,
        middlewares: ["global::dev-only"],
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
    // License Portal Endpoints
    // Rate limited to prevent brute force attacks
    {
      method: "POST",
      path: "/license/activate",
      handler: "custom.licenseActivate",
      config: {
        auth: false,
        middlewares: ["global::license-rate-limit"],
      },
    },
    {
      method: "POST",
      path: "/license/deactivate",
      handler: "custom.licenseDeactivate",
      config: {
        auth: false,
        middlewares: ["global::license-rate-limit"],
      },
    },
    // LOCKED: License reset is extremely dangerous - requires admin token
    {
      method: "POST",
      path: "/license/reset",
      handler: "custom.licenseReset",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
    // Development-only endpoint to recalculate commission amounts
    // LOCKED: Blocked in production via dev-only middleware
    {
      method: "POST",
      path: "/dev/recalculate-commissions",
      handler: "custom.devRecalculateCommissions",
      config: {
        auth: false,
        middlewares: ["global::dev-only"],
      },
    },
    // LOCKED: Manual credit purchase requires admin token
    {
      method: "POST",
      path: "/purchases/manual-credit",
      handler: "custom.manualCreditPurchase",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
    // Visitor tracking for affiliate conversions
    {
      method: "POST",
      path: "/track-affiliate-visit",
      handler: "custom.trackAffiliateVisit",
      config: {
        auth: false,
      },
    },
    // LOCKED: Requires admin token to view affiliate leads
    {
      method: "GET",
      path: "/affiliate-leads",
      handler: "custom.getAffiliateLeads",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
    // LOCKED: Requires admin token to view affiliate stats
    {
      method: "GET",
      path: "/affiliate-stats",
      handler: "custom.getAffiliateStats",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
    // Enhanced conversion event tracking for detailed funnel analysis
    {
      method: "POST",
      path: "/track-conversion-event",
      handler: "custom.trackConversionEvent",
      config: {
        auth: false,
      },
    },
    // Enhanced user journey tracking
    {
      method: "POST",
      path: "/track-visitor-journey",
      handler: "custom.trackVisitorJourney",
      config: {
        auth: false,
      },
    },
    // LOCKED: Requires admin token to view visitor journeys
    {
      method: "GET",
      path: "/visitor-journeys",
      handler: "custom.getVisitorJourneys",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
    // LOCKED: Clear visitor data is dangerous - requires admin token
    {
      method: "POST",
      path: "/clear-visitor-data",
      handler: "custom.clearVisitorData",
      config: {
        auth: false,
        middlewares: ["global::admin-internal"],
      },
    },
  ],
};
