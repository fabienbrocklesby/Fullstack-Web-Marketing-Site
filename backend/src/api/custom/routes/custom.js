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
    // License Portal Endpoints
    {
      method: "POST",
      path: "/license/activate",
      handler: "custom.licenseActivate",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/license/deactivate",
      handler: "custom.licenseDeactivate",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/license/reset",
      handler: "custom.licenseReset",
      config: {
        auth: false,
      },
    },
    // Development-only endpoint to recalculate commission amounts
    {
      method: "POST",
      path: "/dev/recalculate-commissions",
      handler: "custom.devRecalculateCommissions",
      config: {
        auth: false,
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
    // Get affiliate conversion stats
    {
      method: "GET",
      path: "/affiliate-stats",
      handler: "custom.getAffiliateStats",
      config: {
        auth: false,
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
    // Get detailed visitor journeys and clickstreams
    {
      method: "GET",
      path: "/visitor-journeys",
      handler: "custom.getVisitorJourneys",
      config: {
        auth: false,
      },
    },
    // Clear visitor journey data
    {
      method: "POST",
      path: "/clear-visitor-data",
      handler: "custom.clearVisitorData",
      config: {
        auth: false,
      },
    },
  ],
};
