const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");
const { audit, maskSensitive } = require("../../../utils/audit-logger");
const { determineEntitlementTier } = require("../../../utils/entitlement-mapping");
const { getRS256PrivateKey } = require("../../../utils/jwt-keys");
const { processStripeEvent } = require("../../../utils/stripe-webhook-handler");

// Helper: generate a unique-ish license key. This used to live in the license-key controller
// but was referenced here without being in scope, causing a ReferenceError and aborting the
// purchase processing before creating the license key. We inline it here to ensure availability.
// Format: <PROD>-<CUST>-<BASE36TIME>-<RANDHEX>
function generateLicenseKey(productName, customerId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomString = crypto.randomBytes(8).toString("hex").toUpperCase();
  const productCode = (productName || "PRD").substring(0, 3).toUpperCase();
  const customerCode = (customerId?.toString() || "0000").substring(0, 4);
  const key = `${productCode}-${customerCode}-${timestamp}-${randomString}`;
  return key;
}

// Price configuration from environment or defaults
// These map frontend priceIds to actual Stripe price IDs
function getPriceConfig() {
  return {
    // One-time payments
    price_starter: {
      stripeId: process.env.STRIPE_PRICE_ID_MAKER_ONETIME || "price_starter_test",
      amount: 9900, // $99.00 in cents (fallback)
      name: "Hobbyist Plan",
      tier: "maker",
      description: "Complete source code with basic documentation and email support",
    },
    price_pro: {
      stripeId: process.env.STRIPE_PRICE_ID_PRO_ONETIME || "price_pro_test",
      amount: 19900, // $199.00 in cents (fallback)
      name: "Pro Plan",
      tier: "pro",
      description: "Everything in Hobbyist plus premium components and priority support",
    },
    // Subscription prices
    price_starter_sub: {
      stripeId: process.env.STRIPE_PRICE_ID_MAKER_SUB_MONTHLY || null,
      name: "Hobbyist Monthly",
      tier: "maker",
      description: "Monthly subscription for Hobbyist tier",
    },
    price_pro_sub: {
      stripeId: process.env.STRIPE_PRICE_ID_PRO_SUB_MONTHLY || null,
      name: "Pro Monthly",
      tier: "pro",
      description: "Monthly subscription for Pro tier",
    },
  };
}

// Legacy PRICE_MAPPINGS for backward compatibility
const PRICE_MAPPINGS = {
  price_starter: {
    id: "price_starter_test",
    amount: 9900,
    name: "Starter Plan",
    description: "Complete source code with basic documentation and email support",
  },
  price_pro: {
    id: "price_pro_test",
    amount: 19900,
    name: "Pro Plan",
    description: "Everything in Starter plus premium components and priority support",
  },
  price_enterprise: {
    id: "price_enterprise_test",
    amount: 49900,
    name: "Enterprise Plan",
    description: "Everything in Pro plus custom integrations and 1-on-1 consultation",
  },
};

module.exports = {
  async affiliateCheckout(ctx) {
    try {
      const { priceId, affiliateCode, successUrl, cancelUrl } =
        ctx.request.body;

      console.log("Checkout request:", {
        priceId,
        affiliateCode,
        successUrl,
        cancelUrl,
      });

      if (!priceId) {
        ctx.status = 400;
        ctx.body = { error: "Price ID is required" };
        return;
      }

      // Get price info
      const priceInfo = PRICE_MAPPINGS[priceId];
      if (!priceInfo) {
        console.log("Invalid price ID:", priceId);
        console.log("Available prices:", Object.keys(PRICE_MAPPINGS));
        ctx.status = 400;
        ctx.body = {
          error: "Invalid price ID",
          availablePrices: Object.keys(PRICE_MAPPINGS),
        };
        return;
      }

      // Ensure Stripe key is configured on the server
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error(
          "Stripe configuration error: STRIPE_SECRET_KEY is missing in backend environment",
        );
        ctx.status = 500;
        ctx.body = {
          error: "Stripe not configured on server",
          message:
            "STRIPE_SECRET_KEY is not set in the backend environment. Add it to backend/.env and restart the backend.",
        };
        return;
      }

      console.log(
        "Creating checkout session for:",
        priceInfo,
        "(Stripe key loaded, ends with)",
        String(process.env.STRIPE_SECRET_KEY).slice(-4),
      );

      // For development, create a checkout session with fixed price
      // In production, you'd use real Stripe price IDs
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: priceInfo.name,
                description: priceInfo.description,
              },
              unit_amount: priceInfo.amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&price_id=${priceId}&amount=${priceInfo.amount}`,
        cancel_url: cancelUrl,
        metadata: {
          affiliateCode: affiliateCode || "",
          originalPriceId: priceId,
          priceAmount: priceInfo.amount.toString(),
        },
      });

      console.log("Checkout session created:", session.id);

      ctx.body = {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error("Stripe checkout error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to create checkout session",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  async customerCheckout(ctx) {
    try {
      const { priceId, affiliateCode, successUrl, cancelUrl } =
        ctx.request.body;
      const customerId = ctx.state.customer?.id;

      console.log("Customer checkout request:", {
        priceId,
        affiliateCode,
        customerId,
      });

      if (!customerId) {
        return ctx.unauthorized("Customer authentication required");
      }

      if (!priceId) {
        ctx.status = 400;
        ctx.body = { error: "Price ID is required" };
        return;
      }

      // Get customer details
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId,
      );
      if (!customer) {
        return ctx.notFound("Customer not found");
      }

      // Get price info
      const priceInfo = PRICE_MAPPINGS[priceId];
      if (!priceInfo) {
        console.log("Invalid price ID:", priceId);
        console.log("Available prices:", Object.keys(PRICE_MAPPINGS));
        ctx.status = 400;
        ctx.body = {
          error: "Invalid price ID",
          availablePrices: Object.keys(PRICE_MAPPINGS),
        };
        return;
      }

      // Ensure Stripe key is configured on the server
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error(
          "Stripe configuration error: STRIPE_SECRET_KEY is missing in backend environment",
        );
        ctx.status = 500;
        ctx.body = {
          error: "Stripe not configured on server",
          message:
            "STRIPE_SECRET_KEY is not set in the backend environment. Add it to backend/.env and restart the backend.",
        };
        return;
      }

      console.log(
        "Creating customer checkout session for:",
        priceInfo,
        "(Stripe key loaded, ends with)",
        String(process.env.STRIPE_SECRET_KEY).slice(-4),
      );

      // Create Stripe checkout session with customer info
      const session = await stripe.checkout.sessions.create({
        customer_email: customer.email,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: priceInfo.name,
                description: priceInfo.description,
              },
              unit_amount: priceInfo.amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        // Simplified success URL - only session_id, no amount/price to prevent tampering
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          affiliateCode: affiliateCode || "",
          priceId: priceId,
          tier: priceId === "price_starter" ? "maker" : "pro",
          purchaseMode: "payment",
          customerId: customerId.toString(),
          customerEmail: customer.email,
        },
      });

      console.log("Customer checkout session created:", session.id);

      ctx.body = {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error("Customer checkout error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to create checkout session",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  async stripeWebhook(ctx) {
    const sig = ctx.request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Require webhook secret - no bypass even in development
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      ctx.status = 500;
      ctx.body = { error: "Webhook not configured" };
      return;
    }

    // Get raw body for signature verification
    // This is set by the stripe-raw-body middleware
    const rawBody = ctx.request.rawBody;
    if (!rawBody) {
      console.error("[Webhook] Raw body not available - stripe-raw-body middleware may not be configured correctly");
      console.error("[Webhook] Middleware order in config/middlewares.js: stripe-raw-body MUST come before strapi::body");
      ctx.status = 400;
      ctx.body = { error: "Raw body required for signature verification" };
      return;
    }

    if (!sig) {
      console.error("[Webhook] Missing stripe-signature header");
      ctx.status = 400;
      ctx.body = { error: "Missing stripe-signature header" };
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("[Webhook] Signature verification failed:", err.message);
      ctx.status = 400;
      ctx.body = { error: "Webhook signature verification failed" };
      return;
    }

    console.log(`[Webhook] ✅ Verified event: ${event.type} (${event.id})`);

    try {
      const result = await processStripeEvent(event);
      console.log(`[Webhook] Processed: ${JSON.stringify(result)}`);
      // Return 200 quickly to acknowledge receipt
      ctx.status = 200;
      ctx.body = { received: true, ...result };
    } catch (err) {
      console.error(`[Webhook] Error processing event ${event.id}:`, err.message);
      // Return 500 so Stripe retries
      ctx.status = 500;
      ctx.body = { error: "Failed to process webhook event" };
    }
  },

  // Development-only endpoint to manually create purchase records
  async devCreatePurchase(ctx) {
    if (process.env.NODE_ENV !== "development") {
      return ctx.forbidden("This endpoint is only available in development");
    }

    try {
      const { sessionId, amount, customerEmail, priceId, affiliateCode } =
        ctx.request.body;

      if (!sessionId || !amount || !priceId) {
        return ctx.badRequest("sessionId, amount, and priceId are required");
      }

      console.log("🧪 DEV: Creating purchase manually:", {
        sessionId,
        amount,
        customerEmail,
        priceId,
        affiliateCode,
      });

      // Get the actual customer email from Stripe session
      let actualCustomerEmail = customerEmail || "test@example.com";
      try {
        const stripeSession =
          await stripe.checkout.sessions.retrieve(sessionId);
        if (stripeSession.customer_details?.email) {
          actualCustomerEmail = stripeSession.customer_details.email;
          console.log(
            "📧 Retrieved customer email from Stripe:",
            actualCustomerEmail,
          );
        } else if (stripeSession.customer_email) {
          actualCustomerEmail = stripeSession.customer_email;
          console.log(
            "📧 Retrieved customer email from Stripe (legacy):",
            actualCustomerEmail,
          );
        }
      } catch (stripeError) {
        console.warn(
          "⚠️ Could not retrieve customer email from Stripe:",
          stripeError.message,
        );
      }

      // Find affiliate if code exists
      let affiliate = null;
      if (affiliateCode) {
        const affiliates = await strapi.entityService.findMany(
          "api::affiliate.affiliate",
          {
            filters: { code: affiliateCode, isActive: true },
          },
        );
        affiliate = affiliates.length > 0 ? affiliates[0] : null;
        console.log("🔗 Found affiliate:", affiliate ? affiliate.code : "None");
      }

      // Calculate commission (10% default)
      const commissionRate = affiliate?.commissionRate || 0.1;
      const commissionAmount = affiliate ? amount * commissionRate : 0;

      // Create purchase record
      const purchase = await strapi.entityService.create(
        "api::purchase.purchase",
        {
          data: {
            stripeSessionId: sessionId,
            amount: amount,
            customerEmail: actualCustomerEmail,
            priceId: priceId,
            affiliate: affiliate ? affiliate.id : null,
            commissionAmount,
            metadata: {
              createdVia: "development-endpoint",
              timestamp: new Date().toISOString(),
            },
          },
        },
      );

      // Update affiliate earnings
      if (affiliate) {
        await strapi.entityService.update(
          "api::affiliate.affiliate",
          affiliate.id,
          {
            data: {
              totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
            },
          },
        );
        console.log(
          "💰 Updated affiliate earnings:",
          affiliate.totalEarnings + commissionAmount,
        );
      }

      console.log("✅ Purchase created successfully:", purchase.id);

      ctx.body = {
        success: true,
        purchase: purchase,
        affiliate: affiliate,
        message: "Purchase created successfully in development mode",
      };
    } catch (error) {
      console.error("❌ Error creating purchase:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to create purchase",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  async myPurchases(ctx) {
    try {
      // Get the user from the request
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized(
          "You must be logged in to access purchase data",
        );
      }

      // Find user's affiliate record first
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      if (affiliates.length === 0) {
        ctx.body = {
          data: [],
          meta: {
            pagination: {
              page: 1,
              pageSize: 0,
              pageCount: 1,
              total: 0,
            },
          },
        };
        return;
      }

      const affiliate = affiliates[0];

      // Find purchases for this affiliate
      const purchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: {
            affiliate: affiliate.id,
            ...ctx.query.filters,
          },
          populate: ["affiliate"],
          sort: ctx.query.sort || { createdAt: "desc" },
          pagination: ctx.query.pagination || { page: 1, pageSize: 25 },
        },
      );

      ctx.body = {
        data: purchases,
        meta: {
          pagination: {
            page: 1,
            pageSize: purchases.length,
            pageCount: 1,
            total: purchases.length,
          },
        },
      };
    } catch (error) {
      console.error("Error fetching purchases:", error);
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: "InternalServerError",
          message: "Failed to fetch purchase data",
          details: process.env.NODE_ENV === "development" ? error.stack : {},
        },
      };
    }
  },

  /**
   * DEPRECATED: Frontend fulfillment endpoint
   * Fulfillment is now handled by Stripe webhook (server truth)
   * Returns 410 Gone to signal clients to use polling instead
   */
  async processCustomerPurchase(ctx) {
    console.warn("[DEPRECATED] processCustomerPurchase called - fulfillment now handled by webhook");
    ctx.status = 410;
    ctx.body = {
      error: "Gone",
      message: "Purchase fulfillment is now handled by webhook. Use GET /api/customer/purchase-status?session_id=... to poll for completion.",
      deprecated: true,
    };
  },

  /**
   * Subscription Checkout: Create a subscription checkout session
   * POST /api/customer-checkout-subscription
   *
   * Input: { tier: 'maker' | 'pro', successPath?, cancelPath?, affiliateCode? }
   * Output: { url, sessionId }
   */
  async customerCheckoutSubscription(ctx) {
    try {
      const { tier, affiliateCode, successPath, cancelPath } = ctx.request.body;
      const customerId = ctx.state.customer?.id;

      if (!customerId) {
        return ctx.unauthorized("Customer authentication required");
      }

      // ============================================================
      // Step 1: Validate all required config BEFORE doing anything
      // ============================================================
      const missingConfig = [];
      if (!process.env.STRIPE_SECRET_KEY) {
        missingConfig.push("STRIPE_SECRET_KEY");
      }
      if (!process.env.STRIPE_PRICE_MAKER_MONTHLY) {
        missingConfig.push("STRIPE_PRICE_MAKER_MONTHLY");
      }
      if (!process.env.STRIPE_PRICE_PRO_MONTHLY) {
        missingConfig.push("STRIPE_PRICE_PRO_MONTHLY");
      }
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4321";
      if (!frontendUrl) {
        missingConfig.push("FRONTEND_URL");
      }

      if (missingConfig.length > 0) {
        console.error(`[SubscriptionCheckout] Missing config: ${missingConfig.join(", ")}`);
        ctx.status = 500;
        ctx.body = {
          error: "Server configuration error",
          message: `Missing required environment variables: ${missingConfig.join(", ")}`,
          missingKeys: missingConfig,
        };
        return;
      }

      // Validate tier
      if (!tier || !["maker", "pro"].includes(tier)) {
        ctx.status = 400;
        ctx.body = {
          error: "Invalid tier",
          message: "tier must be 'maker' or 'pro'",
        };
        return;
      }

      // Get customer details
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId,
      );
      if (!customer) {
        return ctx.notFound("Customer not found");
      }

      // ============================================================
      // Step 2: Get subscription price ID from tier
      // ============================================================
      const { getSubscriptionPriceId, normalizeTierKey } =
        require("../../../utils/stripe-pricing");

      // Normalize tier (accepts hobbyists/starter as aliases for maker)
      const normalizedTier = normalizeTierKey(tier);
      if (!normalizedTier) {
        ctx.status = 400;
        ctx.body = {
          error: "Invalid tier",
          message: "tier must be 'maker' or 'pro' (or aliases: hobbyists, starter)",
        };
        return;
      }

      // Get the Stripe Price ID directly from env vars
      let stripePriceId;
      try {
        stripePriceId = getSubscriptionPriceId(normalizedTier);
        console.log(`[SubscriptionCheckout] Using price ID: ${stripePriceId} for tier: ${normalizedTier}`);
      } catch (priceError) {
        console.error(`[SubscriptionCheckout] Failed to get subscription price for tier ${normalizedTier}:`, priceError.message);
        ctx.status = 500;
        ctx.body = {
          error: "Price not configured",
          message: priceError.message,
        };
        return;
      }

      // ============================================================
      // Step 3: Get or create Stripe customer
      // ============================================================
      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        try {
          const stripeCustomer = await stripe.customers.create({
            email: customer.email,
            name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email,
            metadata: {
              strapiCustomerId: customerId.toString(),
            },
          });
          stripeCustomerId = stripeCustomer.id;

          // Save Stripe customer ID to Strapi
          await strapi.entityService.update(
            "api::customer.customer",
            customerId,
            { data: { stripeCustomerId } }
          );
          console.log(`[SubscriptionCheckout] Created Stripe customer ${stripeCustomerId} for ${customer.email}`);
        } catch (customerErr) {
          console.error(`[SubscriptionCheckout] Failed to create Stripe customer:`, {
            message: customerErr.message,
            type: customerErr.type,
            code: customerErr.code,
          });
          ctx.status = 500;
          ctx.body = {
            error: "Failed to create Stripe customer",
            message: customerErr.message,
          };
          return;
        }
      }

      // ============================================================
      // Step 4: Build checkout URLs
      // ============================================================
      const successUrl = `${frontendUrl}${successPath || "/customer/success"}?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendUrl}${cancelPath || "/customer/dashboard"}`;

      console.log(`[SubscriptionCheckout] Creating session:`, {
        customer: stripeCustomerId,
        price: stripePriceId,
        tier: normalizedTier,
        successUrl,
        cancelUrl,
      });

      // ============================================================
      // Step 5: Create subscription checkout session with detailed error handling
      // ============================================================
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          client_reference_id: customerId.toString(),
          payment_method_types: ["card"],
          line_items: [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            affiliateCode: affiliateCode || "",
            tier: normalizedTier,
            priceId: stripePriceId,
            purchaseMode: "subscription",
            customerId: customerId.toString(),
            customerEmail: customer.email,
          },
        });
      } catch (stripeErr) {
        // Log detailed Stripe error information
        console.error(`[SubscriptionCheckout] Stripe checkout.sessions.create failed:`, {
          message: stripeErr.message,
          type: stripeErr.type,
          code: stripeErr.code,
          param: stripeErr.param,
          statusCode: stripeErr.statusCode,
          rawMessage: stripeErr.raw?.message,
          rawParam: stripeErr.raw?.param,
          rawCode: stripeErr.raw?.code,
          rawStatusCode: stripeErr.raw?.statusCode,
        });

        // Build a helpful error message
        let userMessage = stripeErr.raw?.message || stripeErr.message;
        
        // Add hints for common errors
        if (stripeErr.code === "resource_missing" || userMessage.includes("No such price")) {
          userMessage += `. Check that ${stripePriceId} exists in your Stripe account and matches the API key mode (test vs live).`;
        } else if (userMessage.includes("not a recurring price") || userMessage.includes("one-time")) {
          userMessage += `. The price ${stripePriceId} must be a recurring monthly price, not a one-time price.`;
        } else if (stripeErr.code === "api_key_invalid" || userMessage.includes("Invalid API Key")) {
          userMessage = "Invalid Stripe API key. Check STRIPE_SECRET_KEY is correct.";
        }

        ctx.status = stripeErr.statusCode || 500;
        ctx.body = {
          error: "Stripe checkout failed",
          message: userMessage,
          stripeCode: stripeErr.code,
        };
        return;
      }

      console.log(`[SubscriptionCheckout] Session created: ${session.id} for tier=${normalizedTier}`);

      ctx.body = {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      // Catch-all for unexpected errors
      console.error("[SubscriptionCheckout] Unexpected error:", {
        message: error.message,
        stack: error.stack,
        type: error.type,
        code: error.code,
      });
      ctx.status = 500;
      ctx.body = {
        error: "Failed to create subscription checkout session",
        message: error.message,
      };
    }
  },

  /**
   * Billing Portal: Create a session for customer to manage subscription
   * POST /api/stripe/billing-portal
   */
  async stripeBillingPortal(ctx) {
    try {
      const { returnUrl } = ctx.request.body;
      const customerId = ctx.state.customer?.id;

      if (!customerId) {
        return ctx.unauthorized("Customer authentication required");
      }

      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId,
      );

      if (!customer || !customer.stripeCustomerId) {
        ctx.status = 400;
        ctx.body = {
          error: "No Stripe customer found",
          message: "You must have an active subscription to access the billing portal",
        };
        return;
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customer.stripeCustomerId,
        return_url: returnUrl || `${process.env.FRONTEND_URL || "http://localhost:4321"}/customer/dashboard`,
      });

      ctx.body = {
        url: session.url,
      };
    } catch (error) {
      console.error("Billing portal error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to create billing portal session",
        message: error.message,
      };
    }
  },

  /**
   * Purchase Status: Poll for purchase/subscription completion (webhook fulfillment)
   * GET /api/customer/purchase-status?session_id=cs_...
   *
   * Handles both:
   * - Legacy one-time purchases (checks Purchase record)
   * - Subscriptions (checks Entitlement directly via Stripe session)
   */
  async purchaseStatus(ctx) {
    try {
      const { session_id: sessionId } = ctx.query;
      const customerId = ctx.state.customer?.id;

      if (!customerId) {
        return ctx.unauthorized("Customer authentication required");
      }

      if (!sessionId) {
        ctx.status = 400;
        ctx.body = { error: "session_id query parameter required" };
        return;
      }

      // Get customer details
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId
      );
      if (!customer) {
        return ctx.notFound("Customer not found");
      }

      // ============================================================
      // Step 1: Retrieve Stripe Checkout Session to determine mode
      // ============================================================
      let stripeSession;
      try {
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new Error("STRIPE_SECRET_KEY not configured");
        }
        const stripeClient = require("stripe")(process.env.STRIPE_SECRET_KEY);
        stripeSession = await stripeClient.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription", "customer"],
        });
      } catch (stripeErr) {
        console.error(`[PurchaseStatus] Failed to retrieve Stripe session ${sessionId}:`, stripeErr.message);
        // If we can't get the session, fall back to legacy behavior
        stripeSession = null;
      }

      // ============================================================
      // Step 2: Verify session belongs to this customer
      // ============================================================
      if (stripeSession) {
        const sessionCustomerId = stripeSession.customer?.id || stripeSession.customer;
        const sessionEmail = stripeSession.customer_email || stripeSession.customer_details?.email;

        // Match by stripeCustomerId or email
        const isOwner = 
          (customer.stripeCustomerId && customer.stripeCustomerId === sessionCustomerId) ||
          (customer.email && sessionEmail && customer.email.toLowerCase() === sessionEmail.toLowerCase());

        if (!isOwner) {
          console.warn(`[PurchaseStatus] Session ${sessionId} does not belong to customer ${customerId}`);
          ctx.status = 403;
          ctx.body = { error: "Access denied" };
          return;
        }
      }

      // ============================================================
      // Step 3: Handle based on session mode
      // ============================================================
      const isSubscription = stripeSession?.mode === "subscription";

      if (isSubscription) {
        // ----- SUBSCRIPTION MODE (READ-ONLY) -----
        // Entitlements are ONLY created by webhook (checkout.session.completed)
        // This endpoint just checks if webhook has processed yet
        console.log(`[PurchaseStatus] Subscription mode for session ${sessionId}`);

        // Get subscription ID from session
        const subscriptionId = stripeSession.subscription?.id || stripeSession.subscription;
        const expectedTier = stripeSession.metadata?.tier || null;

        if (!subscriptionId) {
          console.warn(`[PurchaseStatus] No subscription ID in session ${sessionId}`);
          ctx.body = {
            status: "pending",
            mode: "subscription",
            message: "Subscription is being created. Please wait...",
          };
          return;
        }

        // Query for entitlement created by webhook - ONLY match by stripeSubscriptionId
        // This is the ONLY reliable way to match subscription entitlements
        const entitlements = await strapi.entityService.findMany(
          "api::entitlement.entitlement",
          {
            filters: {
              stripeSubscriptionId: subscriptionId,
              $or: [
                { isArchived: { $null: true } },
                { isArchived: false },
              ],
            },
            populate: ["licenseKey"],
          }
        );

        const matchingEntitlement = entitlements[0] || null;

        if (matchingEntitlement) {
          console.log(`[PurchaseStatus] Subscription complete: entitlement ${matchingEntitlement.id}, tier=${matchingEntitlement.tier}, isLifetime=${matchingEntitlement.isLifetime}, subscriptionId=${subscriptionId}`);
          
          // Build display labels based on entitlement flags (NOT tier)
          // IMPORTANT: Pro/Maker does NOT imply lifetime - only isLifetime flag does
          const accessLabel = matchingEntitlement.isLifetime === true
            ? "Lifetime (Founders)"
            : "Subscription Active";
          
          // Price labels for display
          const tierPriceMap = {
            maker: "$12/month",
            pro: "$24/month",
          };
          const billingLabel = matchingEntitlement.isLifetime
            ? "One-time (Founders)"
            : tierPriceMap[matchingEntitlement.tier] || "Monthly Subscription";

          ctx.body = {
            status: "complete",
            mode: "subscription",
            entitlementId: matchingEntitlement.id,
            licenseKeyId: matchingEntitlement.licenseKey?.id || null,
            licenseKey: matchingEntitlement.licenseKey?.key || null,
            tier: matchingEntitlement.tier,
            isLifetime: matchingEntitlement.isLifetime || false,
            subscriptionId: subscriptionId,
            // Full entitlement details for frontend display
            entitlement: {
              id: matchingEntitlement.id,
              tier: matchingEntitlement.tier,
              status: matchingEntitlement.status,
              isLifetime: matchingEntitlement.isLifetime || false,
              currentPeriodEnd: matchingEntitlement.currentPeriodEnd || null,
              maxDevices: matchingEntitlement.maxDevices || 1,
            },
            // Display labels (derived from isLifetime, NOT from tier)
            display: {
              accessLabel,
              billingLabel,
            },
          };
          return;
        }

        // No entitlement found - webhook hasn't processed yet
        console.log(`[PurchaseStatus] Subscription pending: no entitlement found for subscriptionId=${subscriptionId}`);
        ctx.body = {
          status: "pending",
          mode: "subscription",
          message: "Subscription is being activated. Please wait...",
          subscriptionId: subscriptionId,
          debug: process.env.NODE_ENV === "development" ? {
            sessionId,
            subscriptionId,
            expectedTier,
            hint: "Waiting for webhook to create entitlement. Is stripe listen running?",
          } : undefined,
        };
        return;
      }

      // ----- LEGACY ONE-TIME PURCHASE MODE -----
      console.log(`[PurchaseStatus] One-time purchase mode for session ${sessionId}`);

      // Find purchase by stripeSessionId
      const purchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: { stripeSessionId: sessionId },
          populate: ["licenseKey", "licenseKey.entitlement"],
        }
      );

      if (purchases.length === 0) {
        // Purchase not yet created by webhook
        ctx.body = {
          status: "pending",
          mode: "payment",
          message: "Purchase is being processed. Please wait...",
        };
        return;
      }

      const purchase = purchases[0];

      // Verify customer owns this purchase
      if (purchase.customer && purchase.customer !== customerId) {
        ctx.status = 403;
        ctx.body = { error: "Access denied" };
        return;
      }

      ctx.body = {
        status: "complete",
        mode: "payment",
        purchaseId: purchase.id,
        licenseKeyId: purchase.licenseKey?.id || null,
        licenseKey: purchase.licenseKey?.key || null,
        entitlementId: purchase.licenseKey?.entitlement?.id || null,
        tier: purchase.licenseKey?.entitlement?.tier || null,
        isLifetime: purchase.licenseKey?.entitlement?.isLifetime || false,
      };
    } catch (error) {
      console.error("Purchase status error:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to check purchase status",
        message: error.message,
      };
    }
  },

  /**
   * Get Pricing: Returns current price IDs for frontend
   * GET /api/pricing
   */
  async getPricing(ctx) {
    const config = getPriceConfig();

    ctx.body = {
      oneTime: {
        maker: {
          priceId: "price_starter",
          stripeId: config.price_starter.stripeId,
          name: config.price_starter.name,
        },
        pro: {
          priceId: "price_pro",
          stripeId: config.price_pro.stripeId,
          name: config.price_pro.name,
        },
      },
      subscription: {
        maker: {
          priceId: "price_starter_sub",
          stripeId: config.price_starter_sub.stripeId,
          available: !!config.price_starter_sub.stripeId,
        },
        pro: {
          priceId: "price_pro_sub",
          stripeId: config.price_pro_sub.stripeId,
          available: !!config.price_pro_sub.stripeId,
        },
      },
    };
  },

  /**
   * License Portal: Activate a license key
   * POST /api/license/activate
   */
  async licenseActivate(ctx) {
    const jwt = require("jsonwebtoken");
    const { v4: uuidv4 } = require("uuid");
    const crypto = require("crypto");

    try {
      const { licenceKey, machineId } = ctx.request.body;

      // Validate input
      if (!licenceKey || !machineId) {
        audit.licenseActivation(ctx, "denied", "missing_fields", { licenceKey: maskSensitive(licenceKey), machineId });
        ctx.status = 400;
        ctx.body = { error: "licenceKey and machineId are required" };
        return;
      }

      // Find the license by key
      const license = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: { key: licenceKey },
          populate: ["entitlement", "customer"],
          limit: 1,
        },
      );

      if (!license || license.length === 0) {
        audit.licenseActivation(ctx, "denied", "not_found", { licenceKey: maskSensitive(licenceKey), machineId });
        ctx.status = 404;
        ctx.body = { error: "License key not found" };
        return;
      }

      const licenseRecord = license[0];

      // Stage 2 Fix: Entitlement is REQUIRED - auto-create if missing
      let entitlement = licenseRecord.entitlement;

      if (!entitlement) {
        // Auto-create entitlement deterministically
        console.log(`🔧 License key #${licenseRecord.id} has no entitlement. Auto-creating...`);

        try {
          // Try to find associated purchase for better tier mapping
          let purchase = null;
          if (licenseRecord.purchase) {
            purchase = await strapi.entityService.findOne(
              "api::purchase.purchase",
              typeof licenseRecord.purchase === "object" ? licenseRecord.purchase.id : licenseRecord.purchase
            );
          }

          // Determine tier
          const tierMapping = determineEntitlementTier({
            priceId: purchase?.priceId || licenseRecord.priceId,
            amount: purchase ? parseFloat(purchase.amount) : null,
            createdAt: purchase?.createdAt || licenseRecord.createdAt,
            metadata: purchase?.metadata || null,
          });

          // Fallback: use licenseKey.typ if mapping uncertain
          if (tierMapping.confidence === "low" && licenseRecord.typ) {
            const typToTier = { starter: "maker", pro: "pro", enterprise: "enterprise", paid: "maker", trial: "maker" };
            const mappedTier = typToTier[licenseRecord.typ];
            if (mappedTier) {
              tierMapping.tier = mappedTier;
              tierMapping.maxDevices = { maker: 1, pro: 1, education: 5, enterprise: 10 }[mappedTier] || 1;
            }
          }

          // Get customer - required for entitlement
          let customerId = null;
          if (licenseRecord.customer) {
            customerId = typeof licenseRecord.customer === "object" ? licenseRecord.customer.id : licenseRecord.customer;
          }

          if (!customerId) {
            console.error(`❌ Cannot auto-create entitlement: license #${licenseRecord.id} has no customer`);
            audit.licenseActivation(ctx, "denied", "no_customer", { licenseId: licenseRecord.id, machineId });
            ctx.status = 400;
            ctx.body = { error: "License has no associated customer. Please contact support." };
            return;
          }

          // Create entitlement
          entitlement = await strapi.entityService.create(
            "api::entitlement.entitlement",
            {
              data: {
                customer: customerId,
                licenseKey: licenseRecord.id,
                purchase: purchase?.id || null,
                tier: tierMapping.tier,
                status: "active",
                isLifetime: tierMapping.isLifetime,
                expiresAt: tierMapping.isLifetime ? null : null,
                maxDevices: tierMapping.maxDevices,
                source: "legacy_purchase",
                metadata: {
                  ...tierMapping.metadata,
                  mappingConfidence: tierMapping.confidence,
                  reason: "autocreated_on_activation",
                  createdAt: new Date().toISOString(),
                },
              },
            }
          );

          console.log(`✅ Auto-created entitlement #${entitlement.id} for license #${licenseRecord.id} (tier: ${tierMapping.tier}, lifetime: ${tierMapping.isLifetime})`);

        } catch (autoCreateErr) {
          console.error(`❌ Failed to auto-create entitlement for license #${licenseRecord.id}:`, autoCreateErr.message);
          audit.licenseActivation(ctx, "error", "entitlement_autocreate_failed", { licenseId: licenseRecord.id, error: autoCreateErr.message });
          ctx.status = 500;
          ctx.body = { error: "Failed to initialize license. Please contact support." };
          return;
        }
      }

      // Enforce entitlement status
      if (entitlement.status !== "active") {
        audit.licenseActivation(ctx, "denied", "entitlement_inactive", {
          licenseId: licenseRecord.id,
          entitlementId: entitlement.id,
          entitlementStatus: entitlement.status,
          machineId,
        });
        ctx.status = 403;
        ctx.body = {
          error: "Entitlement is not active",
          entitlementStatus: entitlement.status,
          message: entitlement.status === "expired"
            ? "Your license has expired. Please renew to continue."
            : entitlement.status === "canceled"
            ? "Your license has been canceled."
            : "Your license is currently inactive.",
        };
        return;
      }

      // Enforce lifetime/expiry consistency
      if (entitlement.isLifetime && entitlement.expiresAt) {
        // Normalize: lifetime entitlements should not have expiresAt
        console.log(`🔧 Normalizing lifetime entitlement #${entitlement.id}: clearing expiresAt`);
        await strapi.entityService.update("api::entitlement.entitlement", entitlement.id, {
          data: { expiresAt: null },
        });
        entitlement.expiresAt = null;
      }

      // Check expiry for non-lifetime entitlements
      if (!entitlement.isLifetime && entitlement.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(entitlement.expiresAt);
        if (expiresAt < now) {
          // Mark as expired
          await strapi.entityService.update("api::entitlement.entitlement", entitlement.id, {
            data: { status: "expired" },
          });
          audit.licenseActivation(ctx, "denied", "entitlement_expired", {
            licenseId: licenseRecord.id,
            entitlementId: entitlement.id,
            expiresAt: entitlement.expiresAt,
            machineId,
          });
          ctx.status = 403;
          ctx.body = {
            error: "License expired",
            message: "Your license has expired. Please renew to continue.",
            expiresAt: entitlement.expiresAt,
          };
          return;
        }
      }

      // Check if license is already active
      if (licenseRecord.status === "active") {
        audit.licenseActivation(ctx, "denied", "already_active", { licenseId: licenseRecord.id, machineId });
        ctx.status = 400;
        ctx.body = { error: "License is already active on another device" };
        return;
      }

      // For trial licenses, only allow one-time activation
      if (licenseRecord.typ === "trial" && licenseRecord.status !== "unused") {
        audit.licenseActivation(ctx, "denied", "trial_already_used", { licenseId: licenseRecord.id, machineId });
        ctx.status = 400;
        ctx.body = { error: "Trial license has already been used" };
        return;
      }

      // Generate new license key and deactivation code for security
      const generateShortKey = () => {
        const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // No confusing chars like 0,O,1,I
        let result = "";
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
          if (i === 3 || i === 7) result += "-"; // Add dashes for readability
        }
        return result;
      };

      const generateDeactivationCode = () => {
        const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
        let result = "";
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Map license types to proper prefixes
      const getPrefix = (typ) => {
        const prefixMap = {
          trial: "TRIAL",
          starter: "STARTER",
          pro: "PRO",
          enterprise: "ENTERPRISE",
          paid: "PAID",
        };
        return prefixMap[typ] || typ.toUpperCase();
      };

      // Generate new identifiers
      const jti = uuidv4();
      const newLicenseKey = `${getPrefix(licenseRecord.typ)}-${generateShortKey()}`;
      const deactivationCode = generateDeactivationCode();
      const now = new Date();
      const trialStart = licenseRecord.typ === "trial" ? now : undefined;

      // Encrypt deactivation code using license key as encryption key
      const encryptDeactivationCode = (code, licenseKey) => {
        const algorithm = "aes-256-cbc";
        const key = crypto.createHash("sha256").update(licenseKey).digest();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(code, "utf8", "hex");
        encrypted += cipher.final("hex");
        return iv.toString("hex") + ":" + encrypted;
      };

      const encryptedDeactivationCode = encryptDeactivationCode(
        deactivationCode,
        newLicenseKey,
      );

      // Update license record with new key and encrypted deactivation code
      await strapi.entityService.update(
        "api::license-key.license-key",
        licenseRecord.id,
        {
          data: {
            key: newLicenseKey, // Generate new key to prevent reuse
            status: "active",
            jti,
            machineId,
            trialStart,
            activatedAt: now,
            isUsed: true,
            deactivationCode: encryptedDeactivationCode, // Store encrypted deactivation code
            currentActivations: 1, // Always 1 for single device
            maxActivations: 1, // Always 1 for single device
          },
        },
      );

      // Create JWT payload with deactivation code
      const payload = {
        iss: process.env.JWT_ISSUER || `https://${ctx.request.host}`,
        sub: licenseRecord.id.toString(),
        jti,
        typ: licenseRecord.typ,
        machineId,
        deactivationCode, // Include deactivation code in JWT
        licenseKey: newLicenseKey,
        iat: Math.floor(now.getTime() / 1000),
      };

      // Add trialStart for trial licenses
      if (licenseRecord.typ === "trial") {
        payload.trialStart = Math.floor(now.getTime() / 1000);
      }

      // Get private key from environment (no filesystem fallback)
      const privateKey = getRS256PrivateKey();
      if (!privateKey) {
        console.error("JWT_PRIVATE_KEY not set in environment");
        ctx.status = 500;
        ctx.body = { error: "JWT private key not configured" };
        return;
      }

      // Sign JWT with RS256
      const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        noTimestamp: true, // We set iat manually
      });

      audit.licenseActivation(ctx, "success", "activated", { licenseId: licenseRecord.id, typ: licenseRecord.typ, machineId });

      ctx.status = 200;
      ctx.body = {
        jwt: token,
        jti,
        machineId,
        licenseKey: newLicenseKey, // Return new license key
        deactivationCode, // Return deactivation code
        ...(licenseRecord.typ === "trial" && { trialStart: now.toISOString() }),
      };
    } catch (error) {
      console.error("License activation error:", error);
      console.error("Error stack:", error.stack);
      audit.licenseActivation(ctx, "error", "internal_error", { error: error.message });
      ctx.status = 500;
      ctx.body = { error: "Internal server error", details: error.message };
    }
  },

  /**
   * License Portal: Deactivate a license key
   * POST /api/license/deactivate
   */
  async licenseDeactivate(ctx) {
    try {
      const { licenceKey, deactivationCode } = ctx.request.body;

      // Validate input
      if (!licenceKey || !deactivationCode) {
        audit.licenseDeactivation(ctx, "denied", "missing_fields", { licenceKey: maskSensitive(licenceKey) });
        ctx.status = 400;
        ctx.body = { error: "licenceKey and deactivationCode are required" };
        return;
      }

      // Find the active license (without checking deactivation code yet)
      const license = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: {
            key: licenceKey,
            status: "active",
          },
          limit: 1,
        },
      );

      if (!license || license.length === 0) {
        audit.licenseDeactivation(ctx, "denied", "not_found_or_inactive", { licenceKey: maskSensitive(licenceKey) });
        ctx.status = 404;
        ctx.body = { error: "License key not found or not active" };
        return;
      }

      const licenseRecord = license[0];

      // Decrypt and verify deactivation code
      const decryptDeactivationCode = (encryptedCode, licenseKey) => {
        try {
          const algorithm = "aes-256-cbc";
          const key = crypto.createHash("sha256").update(licenseKey).digest();
          const parts = encryptedCode.split(":");
          if (parts.length !== 2) return null;
          const iv = Buffer.from(parts[0], "hex");
          const encrypted = parts[1];
          const decipher = crypto.createDecipheriv(algorithm, key, iv);
          let decrypted = decipher.update(encrypted, "hex", "utf8");
          decrypted += decipher.final("utf8");
          return decrypted;
        } catch {
          return null; // Invalid encryption/decryption
        }
      };

      const decryptedCode = decryptDeactivationCode(
        licenseRecord.deactivationCode,
        licenceKey,
      );

      if (!decryptedCode || decryptedCode !== deactivationCode) {
        audit.licenseDeactivation(ctx, "denied", "invalid_deactivation_code", { licenseId: licenseRecord.id });
        ctx.status = 400;
        ctx.body = { error: "Invalid deactivation code" };
        return;
      }

      // Generate new unused license key for future use
      const generateShortKey = () => {
        const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // No confusing chars
        let result = "";
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
          if (i === 3 || i === 7) result += "-";
        }
        return result;
      };

      // Map license types to proper prefixes
      const getPrefix = (typ) => {
        const prefixMap = {
          trial: "TRIAL",
          starter: "STARTER",
          pro: "PRO",
          enterprise: "ENTERPRISE",
          paid: "PAID",
        };
        return prefixMap[typ] || typ.toUpperCase();
      };

      const newLicenseKey = `${getPrefix(licenseRecord.typ)}-${generateShortKey()}`;

      // Deactivate and reset the license with new key
      await strapi.entityService.update(
        "api::license-key.license-key",
        licenseRecord.id,
        {
          data: {
            key: newLicenseKey, // New license key for reuse
            status: "unused",
            jti: null,
            machineId: null,
            trialStart: null,
            activatedAt: null,
            isUsed: false,
            deactivationCode: null, // Clear the encrypted deactivation code
            currentActivations: 0,
          },
        },
      );

      audit.licenseDeactivation(ctx, "success", "deactivated", { licenseId: licenseRecord.id, typ: licenseRecord.typ });

      ctx.status = 200;
      ctx.body = {
        success: true,
        message: "License deactivated successfully",
        newLicenseKey: newLicenseKey,
      };
    } catch (error) {
      console.error("License deactivation error:", error);
      audit.licenseDeactivation(ctx, "error", "internal_error", { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: "Failed to deactivate license",
        details: error.message,
      };
    }
  },

  /**
   * License Portal: Reset all licenses to unused state (for testing)
   * POST /api/license/reset
   */
  async licenseReset(ctx) {
    try {
      console.log("🔄 Resetting all licenses to unused state...");

      // Find all license keys
      const licenses = await strapi.entityService.findMany(
        "api::license-key.license-key",
      );

      console.log(`Found ${licenses.length} licenses to reset`);

      for (const license of licenses) {
        await strapi.entityService.update(
          "api::license-key.license-key",
          license.id,
          {
            data: {
              status: "unused",
              jti: null,
              machineId: null,
              trialStart: null,
              activatedAt: null,
              isUsed: false,
            },
          },
        );
        console.log(`   ✓ Reset license: ${license.key}`);
      }

      ctx.status = 200;
      ctx.body = {
        success: true,
        message: `Reset ${licenses.length} licenses to unused state`,
        licenses: licenses.map((l) => ({ key: l.key, typ: l.typ })),
      };
    } catch (error) {
      console.error("License reset error:", error);
      ctx.status = 500;
      ctx.body = { error: "Failed to reset licenses", details: error.message };
    }
  },

  // Development-only endpoint to recalculate commission amounts
  async devRecalculateCommissions(ctx) {
    if (process.env.NODE_ENV !== "development") {
      return ctx.forbidden("This endpoint is only available in development");
    }

    try {
      console.log("🔄 Recalculating all commission amounts...");

      // Get all purchases with their affiliates
      const purchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          populate: ["affiliate"],
        },
      );

      let updatedCount = 0;
      let totalCommissionBefore = 0;
      let totalCommissionAfter = 0;

      for (const purchase of purchases) {
        const oldCommission = purchase.commissionAmount || 0;
        totalCommissionBefore += oldCommission;

        if (purchase.affiliate) {
          // Calculate new commission based on affiliate's current rate
          const newCommission =
            purchase.amount * purchase.affiliate.commissionRate;

          if (Math.abs(oldCommission - newCommission) > 0.001) {
            // Update the purchase record
            await strapi.entityService.update(
              "api::purchase.purchase",
              purchase.id,
              {
                data: {
                  commissionAmount: newCommission,
                },
              },
            );

            console.log(
              `  ✓ Updated purchase ${purchase.id}: $${oldCommission.toFixed(2)} → $${newCommission.toFixed(2)} (rate: ${(purchase.affiliate.commissionRate * 100).toFixed(1)}%)`,
            );
            updatedCount++;
          }

          totalCommissionAfter += newCommission;
        } else {
          // No affiliate linked - commission should be 0
          if (oldCommission !== 0) {
            await strapi.entityService.update(
              "api::purchase.purchase",
              purchase.id,
              {
                data: {
                  commissionAmount: 0,
                },
              },
            );

            console.log(
              `  ✓ Updated purchase ${purchase.id}: $${oldCommission.toFixed(2)} → $0.00 (no affiliate)`,
            );
            updatedCount++;
          }
        }
      }

      // Update affiliate total earnings
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {},
      );

      for (const affiliate of affiliates) {
        const affiliatePurchases = purchases.filter(
          (p) => p.affiliate?.id === affiliate.id,
        );
        const totalEarnings = affiliatePurchases.reduce(
          (sum, p) =>
            sum + (p.affiliate ? p.amount * affiliate.commissionRate : 0),
          0,
        );

        await strapi.entityService.update(
          "api::affiliate.affiliate",
          affiliate.id,
          {
            data: {
              totalEarnings: totalEarnings,
            },
          },
        );

        console.log(
          `  ✓ Updated affiliate ${affiliate.name}: $${totalEarnings.toFixed(2)} total earnings`,
        );
      }

      ctx.body = {
        success: true,
        message: "Commission amounts recalculated successfully",
        summary: {
          totalPurchases: purchases.length,
          updatedPurchases: updatedCount,
          totalCommissionBefore: totalCommissionBefore.toFixed(2),
          totalCommissionAfter: totalCommissionAfter.toFixed(2),
          difference: (totalCommissionAfter - totalCommissionBefore).toFixed(2),
        },
      };
    } catch (error) {
      console.error("❌ Error recalculating commissions:", error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: "Failed to recalculate commissions",
        details: process.env.NODE_ENV === "development" ? error.message : {},
      };
    }
  },

  // Visitor tracking for affiliate conversions
  async trackAffiliateVisit(ctx) {
    try {
      const { affiliateCode, referrer, userAgent } = ctx.request.body;
      const ipAddress =
        ctx.request.ip ||
        ctx.request.headers["x-forwarded-for"] ||
        ctx.request.connection.remoteAddress;

      if (!affiliateCode) {
        return ctx.badRequest("Affiliate code is required");
      }

      // Find affiliate
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: { code: affiliateCode, isActive: true },
        },
      );

      if (affiliates.length === 0) {
        return ctx.notFound("Affiliate code not found");
      }

      const affiliate = affiliates[0];

      // Create a unique visitor ID based on IP and userAgent to prevent duplicate counting
      const visitorId = require("crypto")
        .createHash("sha256")
        .update(`${ipAddress}-${userAgent}-${affiliateCode}`)
        .digest("hex");

      // Check if we've already tracked this visitor today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingVisit = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: {
            metadata: {
              $containsi: visitorId,
            },
            createdAt: {
              $gte: today.toISOString(),
              $lt: tomorrow.toISOString(),
            },
          },
        },
      );

      // For simplicity, we'll store visit data in the affiliate's metadata
      // In a production app, you'd want a separate visitor tracking table
      let visitMetadata = affiliate.metadata || {};
      if (!visitMetadata.visits) {
        visitMetadata.visits = [];
      }

      // Only add if not already tracked today
      if (existingVisit.length === 0) {
        visitMetadata.visits.push({
          visitorId,
          timestamp: new Date().toISOString(),
          ipAddress,
          userAgent,
          referrer,
        });

        // Keep only last 1000 visits to prevent metadata from growing too large
        if (visitMetadata.visits.length > 1000) {
          visitMetadata.visits = visitMetadata.visits.slice(-1000);
        }

        await strapi.entityService.update(
          "api::affiliate.affiliate",
          affiliate.id,
          {
            data: {
              metadata: visitMetadata,
            },
          },
        );
      }

      ctx.body = {
        success: true,
        message: "Visit tracked successfully",
      };
    } catch (error) {
      console.error("Error tracking affiliate visit:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to track visit",
        message: error.message,
      };
    }
  },

  // Enhanced conversion event tracking for detailed funnel analysis
  async trackConversionEvent(ctx) {
    try {
      const { affiliateCode, eventType, eventData } = ctx.request.body;
      const ipAddress =
        ctx.request.ip ||
        ctx.request.headers["x-forwarded-for"] ||
        ctx.request.connection.remoteAddress;

      if (!affiliateCode || !eventType) {
        return ctx.badRequest("Affiliate code and event type are required");
      }

      // Find affiliate
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: { code: affiliateCode, isActive: true },
        },
      );

      if (affiliates.length === 0) {
        return ctx.notFound("Affiliate code not found");
      }

      const affiliate = affiliates[0];

      // Get or create conversion events metadata
      let conversionMetadata = affiliate.conversionEvents || [];

      // Add new conversion event
      const conversionEvent = {
        eventType: eventType,
        timestamp: new Date().toISOString(),
        ipAddress: ipAddress,
        userAgent: ctx.request.headers["user-agent"],
        ...eventData,
      };

      conversionMetadata.push(conversionEvent);

      // Keep only last 5000 events to prevent metadata from growing too large
      if (conversionMetadata.length > 5000) {
        conversionMetadata = conversionMetadata.slice(-5000);
      }

      // Update affiliate with new conversion event
      await strapi.entityService.update(
        "api::affiliate.affiliate",
        affiliate.id,
        {
          data: {
            conversionEvents: conversionMetadata,
          },
        },
      );

      ctx.body = {
        success: true,
        message: "Conversion event tracked successfully",
      };
    } catch (error) {
      console.error("Error tracking conversion event:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to track conversion event",
        message: error.message,
      };
    }
  },

  // Get affiliate conversion stats
  async getAffiliateStats(ctx) {
    try {
      // Manually handle authentication since this is a custom route
      const authHeader = ctx.request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return ctx.unauthorized("Authorization header required");
      }

      const token = authHeader.split(" ")[1];
      let user = null;

      try {
        // Verify JWT token manually
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "defaultSecret",
        );
        user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { id: decoded.id },
        });
      } catch {
        return ctx.unauthorized("Invalid token");
      }

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // Find user's affiliate record
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      if (affiliates.length === 0) {
        return (ctx.body = {
          visits: 0,
          purchases: 0,
          conversionRate: 0,
          totalEarnings: 0,
        });
      }

      const affiliate = affiliates[0];

      // Get visit count from metadata
      const visitMetadata = affiliate.metadata || {};
      const visits = visitMetadata.visits || [];

      // Filter visits by date range if provided
      const { dateFrom, dateTo } = ctx.query;
      let filteredVisits = visits;

      if (dateFrom || dateTo) {
        filteredVisits = visits.filter((visit) => {
          const visitDate = new Date(visit.timestamp);
          if (dateFrom && visitDate < new Date(dateFrom)) return false;
          if (dateTo && visitDate > new Date(dateTo + "T23:59:59.999Z"))
            return false;
          return true;
        });
      }

      // Get purchases for this affiliate
      let purchaseFilters = {
        affiliate: affiliate.id,
      };

      if (dateFrom || dateTo) {
        purchaseFilters.createdAt = {};
        if (dateFrom)
          purchaseFilters.createdAt.$gte = dateFrom + "T00:00:00.000Z";
        if (dateTo) purchaseFilters.createdAt.$lte = dateTo + "T23:59:59.999Z";
      }

      const purchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: purchaseFilters,
        },
      );

      // Calculate conversion rate and funnel analytics
      const visitCount = filteredVisits.length;
      const purchaseCount = purchases.length;
      // Cap conversion rate at 100% (it's impossible to have more than 100% conversion)
      const rawConversionRate =
        visitCount > 0 ? (purchaseCount / visitCount) * 100 : 0;
      const conversionRate = Math.min(rawConversionRate, 100);

      // Calculate total earnings
      const totalEarnings = purchases.reduce((sum, purchase) => {
        return sum + (purchase.commissionAmount || 0);
      }, 0);

      // Get conversion events for funnel analysis
      const conversionEvents = affiliate.conversionEvents || [];
      const filteredEvents =
        dateFrom || dateTo
          ? conversionEvents.filter((event) => {
              const eventDate = new Date(event.timestamp);
              if (dateFrom && eventDate < new Date(dateFrom + "T00:00:00.000Z"))
                return false;
              if (dateTo && eventDate > new Date(dateTo + "T23:59:59.999Z"))
                return false;
              return true;
            })
          : conversionEvents;

      // Calculate funnel metrics
      const funnelMetrics = {
        visits: visitCount,
        buttonClicks: filteredEvents.filter(
          (e) => e.eventType === "button_click",
        ).length,
        registrationAttempts: filteredEvents.filter(
          (e) => e.eventType === "registration_attempt",
        ).length,
        registrations: filteredEvents.filter(
          (e) => e.eventType === "registration_complete",
        ).length,
        checkoutInitiated: filteredEvents.filter(
          (e) => e.eventType === "checkout_initiated",
        ).length,
        purchases: purchaseCount,
        purchaseComplete: filteredEvents.filter(
          (e) => e.eventType === "purchase_complete",
        ).length,
      };

      ctx.body = {
        visits: visitCount,
        purchases: purchaseCount,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        funnelMetrics: funnelMetrics,
        conversionEvents: filteredEvents.slice(-100), // Last 100 events for analysis
      };
    } catch (error) {
      console.error("Error getting affiliate stats:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to get affiliate stats",
        message: error.message,
      };
    }
  },

  // FIXED: Enhanced visitor tracking with proper session management
  async trackVisitorJourney(ctx) {
    try {
      const { affiliateCode, action, page, eventData } = ctx.request.body;
      const ipAddress =
        ctx.request.ip ||
        ctx.request.headers["x-forwarded-for"] ||
        ctx.request.connection.remoteAddress;
      const userAgent = ctx.request.headers["user-agent"] || "";

      if (!affiliateCode) {
        return ctx.badRequest("Affiliate code is required");
      }

      // Find affiliate
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: { code: affiliateCode, isActive: true },
        },
      );

      if (affiliates.length === 0) {
        return ctx.notFound("Affiliate code not found");
      }

      const affiliate = affiliates[0];

      // Use the visitor ID from frontend (consistent across session)
      const visitorId =
        eventData.visitorId ||
        require("crypto")
          .createHash("sha256")
          .update(`${ipAddress}-${userAgent}`)
          .digest("hex");

      const sessionId = eventData.sessionId || "session_unknown";
      const sessionStart = eventData.sessionStart
        ? new Date(eventData.sessionStart).toISOString()
        : new Date().toISOString();

      // Get or create journey metadata
      let journeyMetadata = affiliate.metadata || {};
      if (!journeyMetadata.userJourneys) {
        journeyMetadata.userJourneys = {};
      }

      // Get or create this visitor's journey
      let visitorJourney = journeyMetadata.userJourneys[visitorId];
      if (!visitorJourney) {
        visitorJourney = {
          visitorId: visitorId,
          firstSeen: sessionStart,
          ipAddress: ipAddress,
          userAgent: userAgent,
          events: [],
          pages: [],
          sessionStart: sessionStart,
          lastActivity: sessionStart,
        };
        journeyMetadata.userJourneys[visitorId] = visitorJourney;
      }

      // Add the action to the journey (preserve original timestamp if provided)
      const originalTimestamp = eventData.timestamp || new Date().toISOString();
      const journeyEvent = {
        timestamp: originalTimestamp,
        action: action,
        page: page,
        sessionId: sessionId,
        data: eventData || {},
        ipAddress: ipAddress,
        userAgent: userAgent,
      };

      visitorJourney.events.push(journeyEvent);
      visitorJourney.lastActivity = new Date().toISOString();

      // Track unique pages visited
      if (page && !visitorJourney.pages.includes(page)) {
        visitorJourney.pages.push(page);
      }

      // Keep only last 100 events per visitor to prevent excessive data growth
      if (visitorJourney.events.length > 100) {
        visitorJourney.events = visitorJourney.events.slice(-100);
      }

      // Keep only last 1000 visitor journeys to prevent excessive data growth
      const journeyIds = Object.keys(journeyMetadata.userJourneys);
      if (journeyIds.length > 1000) {
        // Remove oldest journeys (based on firstSeen timestamp)
        const sortedJourneys = journeyIds
          .map((id) => ({
            id,
            firstSeen: journeyMetadata.userJourneys[id].firstSeen,
          }))
          .sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));

        const toRemove = sortedJourneys.slice(0, sortedJourneys.length - 1000);
        toRemove.forEach((journey) => {
          delete journeyMetadata.userJourneys[journey.id];
        });
      }

      // Update affiliate with new journey data
      await strapi.entityService.update(
        "api::affiliate.affiliate",
        affiliate.id,
        {
          data: {
            metadata: journeyMetadata,
          },
        },
      );

      ctx.body = {
        success: true,
        visitorId: visitorId,
        message: "Journey tracked successfully",
      };
    } catch (error) {
      console.error("Error tracking visitor journey:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to track visitor journey",
        message: error.message,
      };
    }
  },

  // Clear visitor journey data
  async clearVisitorData(ctx) {
    try {
      // Manually handle authentication
      const authHeader = ctx.request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return ctx.unauthorized("Authorization header required");
      }

      const token = authHeader.split(" ")[1];
      let user = null;

      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "defaultSecret",
        );
        user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { id: decoded.id },
        });
      } catch {
        return ctx.unauthorized("Invalid token");
      }

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // Find user's affiliate record
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      if (affiliates.length === 0) {
        return ctx.notFound("Affiliate not found");
      }

      const affiliate = affiliates[0];

      // Clear journey data
      let journeyMetadata = affiliate.metadata || {};
      journeyMetadata.userJourneys = {};

      // Update affiliate with cleared journey data
      await strapi.entityService.update(
        "api::affiliate.affiliate",
        affiliate.id,
        {
          data: {
            metadata: journeyMetadata,
          },
        },
      );

      ctx.body = {
        success: true,
        message: "Visitor journey data cleared successfully",
      };
    } catch (error) {
      console.error("Error clearing visitor data:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to clear visitor journey data",
        message: error.message,
      };
    }
  },

  // Get detailed visitor journeys and clickstreams for affiliate
  async getVisitorJourneys(ctx) {
    try {
      // Manually handle authentication
      const authHeader = ctx.request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return ctx.unauthorized("Authorization header required");
      }

      const token = authHeader.split(" ")[1];
      let user = null;

      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "defaultSecret",
        );
        user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { id: decoded.id },
        });
      } catch {
        return ctx.unauthorized("Invalid token");
      }

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // Find user's affiliate record
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      if (affiliates.length === 0) {
        return (ctx.body = {
          journeys: [],
          summary: {
            totalVisitors: 0,
            totalPageViews: 0,
            averageSessionLength: 0,
            topPages: [],
            conversionFunnel: {},
          },
        });
      }

      const affiliate = affiliates[0];

      // Get journey data
      const journeyMetadata = affiliate.metadata || {};
      const userJourneys = journeyMetadata.userJourneys || {};

      // Filter by date range if provided
      const { dateFrom, dateTo, page } = ctx.query;
      let filteredJourneys = Object.values(userJourneys);

      if (dateFrom || dateTo) {
        filteredJourneys = filteredJourneys.filter((journey) => {
          const journeyDate = new Date(journey.firstSeen);
          if (dateFrom && journeyDate < new Date(dateFrom)) return false;
          if (dateTo && journeyDate > new Date(dateTo + "T23:59:59.999Z"))
            return false;
          return true;
        });
      }

      if (page) {
        filteredJourneys = filteredJourneys.filter((journey) =>
          journey.pages.includes(page),
        );
      }

      // Calculate summary statistics
      const totalVisitors = filteredJourneys.length;
      const totalPageViews = filteredJourneys.reduce(
        (sum, journey) => sum + journey.events.length,
        0,
      );

      // Calculate accurate visit durations using timestamps
      const sessionDurations = filteredJourneys
        .map((journey) => {
          if (journey.events.length < 2) return 0;

          // Extract all valid timestamps from events only (ignore sessionStart which might be wrong)
          const timestamps = journey.events
            .map((e) => {
              if (!e.timestamp) return null;
              const time = new Date(e.timestamp).getTime();
              return isNaN(time) ? null : time;
            })
            .filter((time) => time !== null)
            .sort((a, b) => a - b); // Sort to ensure we get correct earliest/latest

          if (timestamps.length < 2) return 0;

          // Find earliest and latest event timestamps
          const earliestTime = timestamps[0];
          const latestTime = timestamps[timestamps.length - 1];

          // Calculate duration in seconds
          const durationSeconds = (latestTime - earliestTime) / 1000;

          // Only count realistic durations (between 1 second and 24 hours)
          if (durationSeconds < 1 || durationSeconds > 86400) {
            return 0;
          }

          console.log(
            `🕒 Journey ${journey.visitorId.substring(0, 8)} duration: ${durationSeconds}s (${Math.round((durationSeconds / 60) * 10) / 10}min) from ${new Date(earliestTime).toISOString()} to ${new Date(latestTime).toISOString()}`,
          );

          return durationSeconds;
        })
        .filter((duration) => duration > 0);

      // Calculate average duration in minutes for display
      const averageSessionLength =
        sessionDurations.length > 0
          ? sessionDurations.reduce((sum, length) => sum + length, 0) /
            sessionDurations.length /
            60
          : 0;

      // Get top pages
      const pageViews = {};
      filteredJourneys.forEach((journey) => {
        journey.pages.forEach((page) => {
          pageViews[page] = (pageViews[page] || 0) + 1;
        });
      });

      const topPages = Object.entries(pageViews)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([page, views]) => ({ page, views }));

      // Analyze conversion funnel
      const funnelActions = [
        "page_view",
        "button_click",
        "registration_attempt",
        "registration_complete",
        "checkout_initiated",
        "purchase_complete",
      ];
      const conversionFunnel = {};

      funnelActions.forEach((action) => {
        conversionFunnel[action] = filteredJourneys.filter((journey) =>
          journey.events.some((event) => event.action === action),
        ).length;
      });

      // Sort journeys by most recent activity
      const sortedJourneys = filteredJourneys
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, 100); // Return only latest 100 journeys

      ctx.body = {
        journeys: sortedJourneys,
        summary: {
          totalVisitors,
          totalPageViews,
          averageSessionLength: Math.round(averageSessionLength * 10) / 10, // Round to 1 decimal place
          topPages,
          conversionFunnel,
        },
      };
    } catch (error) {
      console.error("Error getting visitor journeys:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to get visitor journeys",
        message: error.message,
      };
    }
  },

  async manualCreditPurchase(ctx) {
    try {
      const {
        customerId,
        priceId,
        affiliateCode,
        amount,
        currency = "usd",
        reason,
      } = ctx.request.body;
      if (!customerId || !priceId || !amount)
        return ctx.badRequest("customerId, priceId, amount required");
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId,
      );
      if (!customer) return ctx.notFound("customer");
      let affiliate = null;
      if (affiliateCode) {
        const list = await strapi.entityService.findMany(
          "api::affiliate.affiliate",
          { filters: { code: affiliateCode } },
        );
        affiliate = list[0] || null;
      }
      const sessionId = `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const commissionRate = affiliate?.commissionRate || 0.1;
      const commissionAmount = affiliate ? amount * commissionRate : 0;
      const purchase = await strapi.entityService.create(
        "api::purchase.purchase",
        {
          data: {
            stripeSessionId: sessionId,
            amount,
            currency,
            customerEmail: customer.email,
            priceId,
            customer: customer.id,
            affiliate: affiliate ? affiliate.id : null,
            commissionAmount,
            isManual: true,
            manualReason: reason || "manual credit",
            metadata: { createdVia: "manual-credit" },
          },
        },
      );
      if (affiliate) {
        await strapi.entityService.update(
          "api::affiliate.affiliate",
          affiliate.id,
          {
            data: {
              totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
            },
          },
        );
      }
      const licenseKey = `LIC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const licenseKeyRecord = await strapi.entityService.create(
        "api::license-key.license-key",
        {
          data: {
            key: licenseKey,
            productName: priceId,
            priceId,
            customer: customer.id,
            purchase: purchase.id,
            isActive: true,
            isUsed: false,
            maxActivations: 1,
            currentActivations: 0,
          },
        },
      );
      await strapi.entityService.update("api::purchase.purchase", purchase.id, {
        data: { licenseKey: licenseKeyRecord.id },
      });
      ctx.body = {
        success: true,
        purchaseId: purchase.id,
        licenseKey: licenseKeyRecord.key,
      };
    } catch (e) {
      ctx.status = 500;
      ctx.body = { error: e.message };
    }
  },

  async getAffiliateLeads(ctx) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        { filters: { $or: [{ user: user.id }, { email: user.email }] } },
      );
      if (!affiliates.length) return (ctx.body = { data: [] });
      const affiliate = affiliates[0];
      const enquiries = await strapi.entityService.findMany(
        "api::enquiry.enquiry",
        {
          filters: { affiliateCode: affiliate.code },
          sort: { createdAt: "desc" },
        },
      );
      ctx.body = { data: enquiries };
    } catch (e) {
      ctx.status = 500;
      ctx.body = { error: e.message };
    }
  },

  // ===========================================================================
  // Stage 4: Unified Device-Based Activation API
  // These endpoints use customer auth + deviceId (not MAC-based legacy)
  // ===========================================================================

  /**
   * POST /api/device/register
   * Register a device for the authenticated customer
   * Body: { deviceId: string, publicKey: string, deviceName?: string, platform?: string }
   */
  async deviceRegister(ctx) {
    const crypto = require("crypto");

    try {
      const customer = ctx.state.customer;
      if (!customer) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const { deviceId, publicKey, deviceName, platform } = ctx.request.body;

      // Validate required fields
      if (!deviceId || typeof deviceId !== "string" || deviceId.length < 8) {
        audit.deviceRegister(ctx, {
          outcome: "failure",
          reason: "invalid_device_id",
          customerId: customer.id,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "deviceId is required and must be at least 8 characters" };
        return;
      }

      if (!publicKey || typeof publicKey !== "string" || publicKey.length < 32) {
        audit.deviceRegister(ctx, {
          outcome: "failure",
          reason: "invalid_public_key",
          customerId: customer.id,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "publicKey is required and must be at least 32 characters" };
        return;
      }

      // Hash the public key for storage (truncated for audit logs)
      const publicKeyHash = crypto
        .createHash("sha256")
        .update(publicKey)
        .digest("hex")
        .slice(0, 16);

      // Check if device already exists
      const existingDevices = await strapi.entityService.findMany(
        "api::device.device",
        {
          filters: { deviceId },
          populate: ["customer"],
        }
      );

      if (existingDevices.length > 0) {
        const existingDevice = existingDevices[0];

        // Device exists - check if it belongs to the same customer
        const existingCustomerId = existingDevice.customer?.id || existingDevice.customer;

        if (existingCustomerId && existingCustomerId !== customer.id) {
          // Device is linked to a different customer - reject
          audit.deviceRegister(ctx, {
            outcome: "failure",
            reason: "device_owned_by_another",
            customerId: customer.id,
            deviceIdHash: publicKeyHash,
          });
          ctx.status = 409;
          ctx.body = { error: "Device is registered to another account" };
          return;
        }

        // Device belongs to this customer - update it
        const updatedDevice = await strapi.entityService.update(
          "api::device.device",
          existingDevice.id,
          {
            data: {
              publicKey,
              publicKeyHash,
              deviceName: deviceName || existingDevice.deviceName,
              platform: platform || existingDevice.platform || "unknown",
              lastSeenAt: new Date(),
              status: existingDevice.status === "blocked" ? "blocked" : "active",
            },
          }
        );

        audit.deviceRegister(ctx, {
          outcome: "success",
          reason: "device_updated",
          customerId: customer.id,
          deviceIdHash: publicKeyHash,
        });

        ctx.body = {
          deviceId: updatedDevice.deviceId,
          status: updatedDevice.status,
          message: "Device updated",
        };
        return;
      }

      // Create new device
      const newDevice = await strapi.entityService.create(
        "api::device.device",
        {
          data: {
            deviceId,
            publicKey,
            publicKeyHash,
            deviceName: deviceName || null,
            platform: platform || "unknown",
            customer: customer.id,
            status: "active",
            lastSeenAt: new Date(),
          },
        }
      );

      audit.deviceRegister(ctx, {
        outcome: "success",
        reason: "device_created",
        customerId: customer.id,
        deviceIdHash: publicKeyHash,
      });

      ctx.body = {
        deviceId: newDevice.deviceId,
        status: newDevice.status,
        message: "Device registered",
      };
    } catch (err) {
      strapi.log.error(`[deviceRegister] Error: ${err.message}`);
      strapi.log.error(err.stack);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },

  /**
   * POST /api/licence/activate
   * Activate an entitlement on a device
   * Body: { entitlementId: number, deviceId: string }
   */
  async licenceActivate(ctx) {
    try {
      const customer = ctx.state.customer;
      if (!customer) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const { entitlementId, deviceId } = ctx.request.body;

      // Validate required fields
      if (!entitlementId) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "missing_entitlement_id",
          customerId: customer.id,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "entitlementId is required" };
        return;
      }

      if (!deviceId || typeof deviceId !== "string") {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "missing_device_id",
          customerId: customer.id,
          entitlementId,
        });
        ctx.status = 400;
        ctx.body = { error: "deviceId is required" };
        return;
      }

      // Load entitlement and verify ownership
      const entitlement = await strapi.entityService.findOne(
        "api::entitlement.entitlement",
        entitlementId,
        { populate: ["customer", "devices"] }
      );

      if (!entitlement) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "entitlement_not_found",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 404;
        ctx.body = { error: "Entitlement not found" };
        return;
      }

      // Verify ownership
      const entitlementCustomerId = entitlement.customer?.id || entitlement.customer;
      if (entitlementCustomerId !== customer.id) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "not_owner",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "You do not own this entitlement" };
        return;
      }

      // Check entitlement is usable
      const allowedStatuses = ["active"];
      if (!entitlement.isLifetime && !allowedStatuses.includes(entitlement.status)) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "entitlement_not_active",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = {
          error: "Entitlement is not active",
          status: entitlement.status,
        };
        return;
      }

      // Load device and verify ownership
      const devices = await strapi.entityService.findMany(
        "api::device.device",
        {
          filters: { deviceId },
          populate: ["customer", "entitlement"],
        }
      );

      if (devices.length === 0) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "device_not_found",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 404;
        ctx.body = { error: "Device not registered. Please register device first." };
        return;
      }

      const device = devices[0];

      // Verify device ownership
      const deviceCustomerId = device.customer?.id || device.customer;
      if (deviceCustomerId !== customer.id) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "device_not_owned",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is not registered to your account" };
        return;
      }

      // Check device is not blocked
      if (device.status === "blocked") {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "device_blocked",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is blocked" };
        return;
      }

      // Check if device is already bound to this entitlement (idempotent)
      const deviceEntitlementId = device.entitlement?.id || device.entitlement;
      if (deviceEntitlementId === entitlement.id && device.status === "active") {
        // Already bound - update lastSeenAt and return success
        await strapi.entityService.update(
          "api::device.device",
          device.id,
          { data: { lastSeenAt: new Date() } }
        );

        audit.deviceActivate(ctx, {
          outcome: "success",
          reason: "already_bound",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });

        ctx.body = {
          ok: true,
          message: "Device already activated",
          entitlement: {
            id: entitlement.id,
            tier: entitlement.tier,
            status: entitlement.status,
            isLifetime: entitlement.isLifetime,
            expiresAt: entitlement.expiresAt,
            currentPeriodEnd: entitlement.currentPeriodEnd,
            maxDevices: entitlement.maxDevices,
          },
          device: {
            deviceId: device.deviceId,
            boundAt: device.boundAt,
          },
        };
        return;
      }

      // Enforce maxDevices limit
      // Count active device bindings for this entitlement
      const activeDevices = await strapi.entityService.findMany(
        "api::device.device",
        {
          filters: {
            entitlement: entitlement.id,
            status: "active",
          },
        }
      );

      // Filter out the current device if it's already in the list
      const otherActiveDevices = activeDevices.filter(d => d.id !== device.id);

      if (otherActiveDevices.length >= entitlement.maxDevices) {
        audit.deviceActivate(ctx, {
          outcome: "failure",
          reason: "max_devices_exceeded",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 409;
        ctx.body = {
          error: "Maximum devices limit reached",
          maxDevices: entitlement.maxDevices,
          activeDevices: otherActiveDevices.length,
          message: `Please deactivate another device first. Max devices: ${entitlement.maxDevices}`,
        };
        return;
      }

      // Create binding - update device with entitlement link
      const now = new Date();
      await strapi.entityService.update(
        "api::device.device",
        device.id,
        {
          data: {
            entitlement: entitlement.id,
            status: "active",
            boundAt: now,
            lastSeenAt: now,
            deactivatedAt: null,
          },
        }
      );

      audit.deviceActivate(ctx, {
        outcome: "success",
        reason: "activated",
        customerId: customer.id,
        entitlementId,
        deviceId,
      });

      ctx.body = {
        ok: true,
        message: "Device activated",
        entitlement: {
          id: entitlement.id,
          tier: entitlement.tier,
          status: entitlement.status,
          isLifetime: entitlement.isLifetime,
          expiresAt: entitlement.expiresAt,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          maxDevices: entitlement.maxDevices,
        },
        device: {
          deviceId: device.deviceId,
          boundAt: now,
        },
      };
    } catch (err) {
      strapi.log.error(`[licenceActivate] Error: ${err.message}`);
      strapi.log.error(err.stack);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },

  /**
   * POST /api/licence/refresh
   * Refresh an entitlement binding (heartbeat)
   * Body: { entitlementId: number, deviceId: string, nonce?: string, signature?: string }
   *
   * Stage 4: Just updates lastSeenAt. Stage 5 will add lease token verification.
   */
  async licenceRefresh(ctx) {
    try {
      const customer = ctx.state.customer;
      if (!customer) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const { entitlementId, deviceId, nonce, signature } = ctx.request.body;

      // Validate required fields
      if (!entitlementId || !deviceId) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "missing_fields",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "entitlementId and deviceId are required" };
        return;
      }

      // Load device with entitlement
      const devices = await strapi.entityService.findMany(
        "api::device.device",
        {
          filters: { deviceId },
          populate: ["customer", "entitlement"],
        }
      );

      if (devices.length === 0) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "device_not_found",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 404;
        ctx.body = { error: "Device not found" };
        return;
      }

      const device = devices[0];

      // Verify device ownership
      const deviceCustomerId = device.customer?.id || device.customer;
      if (deviceCustomerId !== customer.id) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "device_not_owned",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is not registered to your account" };
        return;
      }

      // Verify device is bound to the specified entitlement
      const deviceEntitlementId = device.entitlement?.id || device.entitlement;
      if (!deviceEntitlementId || deviceEntitlementId !== parseInt(entitlementId, 10)) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "not_bound",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is not activated for this entitlement" };
        return;
      }

      // Verify device is active
      if (device.status !== "active") {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "device_not_active",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is not active", status: device.status };
        return;
      }

      // Load entitlement to check status
      const entitlement = await strapi.entityService.findOne(
        "api::entitlement.entitlement",
        entitlementId,
        { populate: ["customer"] }
      );

      if (!entitlement) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "entitlement_not_found",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 404;
        ctx.body = { error: "Entitlement not found" };
        return;
      }

      // Check entitlement is still valid
      const isValid = entitlement.isLifetime || entitlement.status === "active";
      if (!isValid) {
        audit.deviceRefresh(ctx, {
          outcome: "failure",
          reason: "entitlement_not_valid",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = {
          ok: false,
          error: "Entitlement is no longer active",
          status: entitlement.status,
        };
        return;
      }

      // TODO Stage 5: Validate nonce/signature for replay protection
      // For now, just log if provided
      if (nonce) {
        strapi.log.debug(`[licenceRefresh] Nonce provided (Stage 5 will verify): ${nonce.slice(0, 8)}...`);
      }

      // Update lastSeenAt on device
      const now = new Date();
      await strapi.entityService.update(
        "api::device.device",
        device.id,
        { data: { lastSeenAt: now } }
      );

      audit.deviceRefresh(ctx, {
        outcome: "success",
        reason: "refreshed",
        customerId: customer.id,
        entitlementId,
        deviceId,
      });

      ctx.body = {
        ok: true,
        status: entitlement.status,
        isLifetime: entitlement.isLifetime,
        expiresAt: entitlement.expiresAt,
        currentPeriodEnd: entitlement.currentPeriodEnd,
        // TODO Stage 5: Return signed lease token here
      };
    } catch (err) {
      strapi.log.error(`[licenceRefresh] Error: ${err.message}`);
      strapi.log.error(err.stack);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },

  /**
   * POST /api/licence/deactivate
   * Deactivate an entitlement from a device
   * Body: { entitlementId: number, deviceId: string, deactivationCode?: string }
   */
  async licenceDeactivate(ctx) {
    try {
      const customer = ctx.state.customer;
      if (!customer) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const { entitlementId, deviceId, deactivationCode } = ctx.request.body;

      // Validate required fields
      if (!entitlementId || !deviceId) {
        audit.deviceDeactivate(ctx, {
          outcome: "failure",
          reason: "missing_fields",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "entitlementId and deviceId are required" };
        return;
      }

      // Load device with entitlement
      const devices = await strapi.entityService.findMany(
        "api::device.device",
        {
          filters: { deviceId },
          populate: ["customer", "entitlement"],
        }
      );

      if (devices.length === 0) {
        audit.deviceDeactivate(ctx, {
          outcome: "failure",
          reason: "device_not_found",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 404;
        ctx.body = { error: "Device not found" };
        return;
      }

      const device = devices[0];

      // Verify device ownership
      const deviceCustomerId = device.customer?.id || device.customer;
      if (deviceCustomerId !== customer.id) {
        audit.deviceDeactivate(ctx, {
          outcome: "failure",
          reason: "device_not_owned",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 403;
        ctx.body = { error: "Device is not registered to your account" };
        return;
      }

      // Verify device is bound to the specified entitlement
      const deviceEntitlementId = device.entitlement?.id || device.entitlement;
      if (!deviceEntitlementId || deviceEntitlementId !== parseInt(entitlementId, 10)) {
        audit.deviceDeactivate(ctx, {
          outcome: "failure",
          reason: "not_bound",
          customerId: customer.id,
          entitlementId,
          deviceId,
        });
        ctx.status = 400;
        ctx.body = { error: "Device is not activated for this entitlement" };
        return;
      }

      // TODO Stage 5: Verify deactivationCode for offline proof
      // For now, just log if provided
      if (deactivationCode) {
        strapi.log.debug(`[licenceDeactivate] Deactivation code provided (Stage 5 will verify): ${deactivationCode.slice(0, 8)}...`);
      }

      // Deactivate - remove entitlement link, set status to deactivated
      const now = new Date();
      await strapi.entityService.update(
        "api::device.device",
        device.id,
        {
          data: {
            entitlement: null,
            status: "deactivated",
            deactivatedAt: now,
          },
        }
      );

      audit.deviceDeactivate(ctx, {
        outcome: "success",
        reason: "deactivated",
        customerId: customer.id,
        entitlementId,
        deviceId,
      });

      ctx.body = {
        ok: true,
        message: "Device deactivated",
      };
    } catch (err) {
      strapi.log.error(`[licenceDeactivate] Error: ${err.message}`);
      strapi.log.error(err.stack);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },
};
