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
    // Billing Portal - create session for customer to manage subscription
    {
      method: "POST",
      path: "/stripe/billing-portal",
      handler: "custom.stripeBillingPortal",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Purchase status polling - used by success page
    {
      method: "GET",
      path: "/customer/purchase-status",
      handler: "custom.purchaseStatus",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // Pricing info endpoint - returns current price IDs
    {
      method: "GET",
      path: "/pricing",
      handler: "custom.getPricing",
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
    // Subscription checkout - creates subscription session
    {
      method: "POST",
      path: "/customer-checkout-subscription",
      handler: "custom.customerCheckoutSubscription",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // DEPRECATED: Frontend fulfillment endpoint - returns 410 Gone
    // Fulfillment is now handled by webhook (server truth)
    {
      method: "POST",
      path: "/process-customer-purchase",
      handler: "custom.processCustomerPurchase",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
    // =========================================================================
    // LEGACY MAC-BASED ENDPOINTS - RETIRED (Stage 5.5 Cutover)
    // These endpoints now return 410 Gone. All activation uses Stage 4/5.
    // =========================================================================
    {
      method: "POST",
      path: "/license/activate",
      handler: "custom.licenseActivateLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::license-rate-limit"],
      },
    },
    {
      method: "POST",
      path: "/license/deactivate",
      handler: "custom.licenseDeactivateLegacyRetired",
      config: {
        auth: false,
        middlewares: ["global::license-rate-limit"],
      },
    },
    // LOCKED: License reset is extremely dangerous - requires admin token
    // (Still available for admin maintenance)
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

    // =========================================================================
    // Stage 4: Unified Device-Based Activation API
    // These endpoints use customer auth + deviceId (not MAC-based legacy)
    // =========================================================================

    // Register a device for a customer
    {
      method: "POST",
      path: "/device/register",
      handler: "custom.deviceRegister",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Activate entitlement on a device
    {
      method: "POST",
      path: "/licence/activate",
      handler: "custom.licenceActivate",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Refresh entitlement binding (heartbeat)
    {
      method: "POST",
      path: "/licence/refresh",
      handler: "custom.licenceRefresh",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Deactivate entitlement from a device
    {
      method: "POST",
      path: "/licence/deactivate",
      handler: "custom.licenceDeactivate",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },

    // =========================================================================
    // Stage 5: Offline Refresh (Challenge/Response) + Lease Token Verification
    // =========================================================================

    // Generate offline challenge token (portal user)
    {
      method: "POST",
      path: "/licence/offline-challenge",
      handler: "custom.offlineChallenge",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Redeem offline challenge for lease token (portal user)
    {
      method: "POST",
      path: "/licence/offline-refresh",
      handler: "custom.offlineRefresh",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Debug: verify a lease token
    {
      method: "POST",
      path: "/licence/verify-lease",
      handler: "custom.verifyLease",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },

    // =========================================================================
    // Air-Gapped Offline Activation Flow (USB/Copy-Paste Codes)
    // =========================================================================

    // Provision an air-gapped device with activation package
    {
      method: "POST",
      path: "/licence/offline-provision",
      handler: "custom.offlineProvision",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Refresh lease for air-gapped device using signed request code
    {
      method: "POST",
      path: "/licence/offline-lease-refresh",
      handler: "custom.offlineLeaseRefresh",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Deactivate air-gapped device using signed deactivation code
    {
      method: "POST",
      path: "/licence/offline-deactivate",
      handler: "custom.offlineDeactivate",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },

    // =========================================================================
    // Trial: Start 14-day free trial (one per account)
    // =========================================================================
    {
      method: "POST",
      path: "/trial/start",
      handler: "custom.trialStart",
      config: {
        auth: false,
        middlewares: ["global::customer-auth", "global::license-rate-limit"],
      },
    },
    // Check trial eligibility (has customer ever had any entitlements/trial)
    {
      method: "GET",
      path: "/trial/status",
      handler: "custom.trialStatus",
      config: {
        auth: false,
        middlewares: ["global::customer-auth"],
      },
    },
  ],
};
