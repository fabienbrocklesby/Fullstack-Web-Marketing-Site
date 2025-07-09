const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Price mappings for development (you'll replace these with real Stripe price IDs)
const PRICE_MAPPINGS = {
  price_starter: {
    id: "price_starter_test",
    amount: 9900, // $99.00 in cents
    name: "Starter Plan",
    description:
      "Complete source code with basic documentation and email support",
  },
  price_pro: {
    id: "price_pro_test",
    amount: 19900, // $199.00 in cents
    name: "Pro Plan",
    description:
      "Everything in Starter plus premium components and priority support",
  },
  price_enterprise: {
    id: "price_enterprise_test",
    amount: 49900, // $499.00 in cents
    name: "Enterprise Plan",
    description:
      "Everything in Pro plus custom integrations and 1-on-1 consultation",
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

      console.log("Creating checkout session for:", priceInfo);

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

      console.log("Creating customer checkout session for:", priceInfo);

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
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&price_id=${priceId}&amount=${priceInfo.amount}`,
        cancel_url: cancelUrl,
        metadata: {
          affiliateCode: affiliateCode || "",
          originalPriceId: priceId,
          priceAmount: priceInfo.amount.toString(),
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

    let event;

    // In development, if webhook secret is not properly configured,
    // we'll skip signature verification and trust the payload
    if (
      process.env.NODE_ENV === "development" &&
      (!webhookSecret || webhookSecret === "whsec_your_webhook_secret")
    ) {
      console.log(
        "🟡 Development mode: Skipping webhook signature verification",
      );
      event = ctx.request.body;
    } else {
      try {
        event = stripe.webhooks.constructEvent(
          ctx.request.body,
          sig,
          webhookSecret,
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return ctx.badRequest("Webhook signature verification failed");
      }
    }

    console.log("📧 Received webhook event:", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log("💳 Processing checkout session:", session.id);
        await handleSuccessfulPayment(session);
        break;
      default:
        console.log(`❓ Unhandled event type ${event.type}`);
    }

    ctx.body = { received: true };
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

  async processCustomerPurchase(ctx) {
    try {
      const { sessionId, priceId, amount, affiliateCode } = ctx.request.body;
      const customerId = ctx.state.customer?.id;

      if (!customerId) {
        return ctx.unauthorized("Customer authentication required");
      }

      if (!sessionId || !priceId || !amount) {
        return ctx.badRequest("Session ID, price ID, and amount are required");
      }

      console.log("🔄 Processing customer purchase:", {
        sessionId,
        priceId,
        amount,
        customerId,
      });

      // Get customer details
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        customerId,
      );
      if (!customer) {
        return ctx.notFound("Customer not found");
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
      const commissionAmount = affiliate ? (amount / 100) * commissionRate : 0;

      // Get product info
      const priceInfo = PRICE_MAPPINGS[priceId] || {
        name: "Unknown Product",
        description: "Product purchase",
      };

      // Check if purchase already exists
      const existingPurchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: { stripeSessionId: sessionId },
        },
      );

      if (existingPurchases.length > 0) {
        const existingPurchase = existingPurchases[0];
        const existingLicenseKey = await strapi.entityService.findMany(
          "api::license-key.license-key",
          {
            filters: { purchase: existingPurchase.id },
          },
        );

        ctx.body = {
          success: true,
          purchase: existingPurchase,
          licenseKey: existingLicenseKey[0] || null,
          affiliate: affiliate,
          message: "Purchase already processed",
        };
        return;
      }

      // Create purchase record
      const purchase = await strapi.entityService.create(
        "api::purchase.purchase",
        {
          data: {
            stripeSessionId: sessionId,
            amount: amount / 100, // Convert from cents
            customerEmail: customer.email,
            priceId: priceId,
            customer: customer.id,
            affiliate: affiliate ? affiliate.id : null,
            commissionAmount,
            status: "completed",
            metadata: {
              processedVia: "customer-purchase-endpoint",
              timestamp: new Date().toISOString(),
            },
          },
        },
      );

      // Generate license key
      const licenseKey = generateLicenseKey(priceInfo.name, customer.id);

      // Create license key record
      const licenseKeyRecord = await strapi.entityService.create(
        "api::license-key.license-key",
        {
          data: {
            key: licenseKey,
            productName: priceInfo.name,
            priceId: priceId,
            customer: customer.id,
            purchase: purchase.id,
            isActive: true,
            isUsed: false,
            maxActivations: 1,
            currentActivations: 0,
          },
        },
      );

      // Update purchase with license key
      await strapi.entityService.update("api::purchase.purchase", purchase.id, {
        data: {
          licenseKey: licenseKeyRecord.id,
        },
      });

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

      console.log("✅ Customer purchase processed successfully:", purchase.id);
      console.log("🔐 License key created:", licenseKey);

      ctx.body = {
        success: true,
        purchase: purchase,
        licenseKey: licenseKeyRecord,
        affiliate: affiliate,
        message: "Purchase processed successfully",
      };
    } catch (error) {
      console.error("❌ Error processing customer purchase:", error);
      ctx.status = 500;
      ctx.body = {
        error: "Failed to process purchase",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },
};

// Helper function to generate license key
function generateLicenseKey(productName, customerId) {
  const timestamp = Date.now().toString(36);
  const randomString = crypto.randomBytes(8).toString("hex").toUpperCase();
  const productCode = productName.substring(0, 3).toUpperCase();
  const customerCode = customerId.toString().substring(0, 4);

  return `${productCode}-${customerCode}-${timestamp}-${randomString}`;
}

// Helper function to create or get customer
async function createOrGetCustomer(email, firstName = "", lastName = "") {
  try {
    // Check if customer already exists
    const existingCustomers = await strapi.entityService.findMany(
      "api::customer.customer",
      {
        filters: { email: email.toLowerCase() },
      },
    );

    if (existingCustomers.length > 0) {
      return existingCustomers[0];
    }

    // Create new customer with temporary password
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const customer = await strapi.entityService.create(
      "api::customer.customer",
      {
        data: {
          email: email.toLowerCase(),
          firstName: firstName || "Customer",
          lastName: lastName || "",
          password: hashedPassword,
          isActive: true,
          emailVerified: false,
        },
      },
    );

    console.log("Created new customer:", customer.id);
    return customer;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

async function handleSuccessfulPayment(session) {
  try {
    const { id: sessionId, amount_total, customer_email, metadata } = session;
    const { affiliateCode, originalPriceId, customerId, customerEmail } =
      metadata;

    console.log(
      "Processing successful payment for:",
      customer_email || customerEmail,
    );

    // Try to get customer from metadata first (for authenticated purchases)
    let customer = null;
    if (customerId) {
      customer = await strapi.entityService.findOne(
        "api::customer.customer",
        parseInt(customerId),
      );
    }

    // If no customer from metadata, create or get customer from email
    if (!customer) {
      customer = await createOrGetCustomer(customer_email || customerEmail);
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
    }

    // Calculate commission (10% default)
    const commissionRate = affiliate?.commissionRate || 0.1;
    const commissionAmount = affiliate
      ? (amount_total / 100) * commissionRate
      : 0;

    // Get product info
    const priceInfo = PRICE_MAPPINGS[originalPriceId] || {
      name: "Unknown Product",
      description: "Product purchase",
    };

    // Check if purchase already exists
    const existingPurchases = await strapi.entityService.findMany(
      "api::purchase.purchase",
      {
        filters: { stripeSessionId: sessionId },
      },
    );

    if (existingPurchases.length > 0) {
      console.log("Purchase already exists for session:", sessionId);
      return;
    }

    // Create purchase record
    const purchase = await strapi.entityService.create(
      "api::purchase.purchase",
      {
        data: {
          stripeSessionId: sessionId,
          amount: amount_total / 100, // Convert from cents
          customerEmail: customer.email,
          priceId: originalPriceId || "unknown",
          customer: customer.id,
          affiliate: affiliate ? affiliate.id : null,
          commissionAmount,
          status: "completed",
          metadata: {
            sessionData: session,
            processedVia: "stripe-webhook",
          },
        },
      },
    );

    // Generate license key
    const licenseKey = generateLicenseKey(priceInfo.name, customer.id);

    // Create license key record
    const licenseKeyRecord = await strapi.entityService.create(
      "api::license-key.license-key",
      {
        data: {
          key: licenseKey,
          productName: priceInfo.name,
          priceId: originalPriceId || "unknown",
          customer: customer.id,
          purchase: purchase.id,
          isActive: true,
          isUsed: false,
          maxActivations: 1,
          currentActivations: 0,
        },
      },
    );

    // Update purchase with license key
    await strapi.entityService.update("api::purchase.purchase", purchase.id, {
      data: {
        licenseKey: licenseKeyRecord.id,
      },
    });

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
    }

    console.log("Purchase recorded successfully:", purchase.id);
    console.log("License key created:", licenseKey);

    // TODO: Send email to customer with license key and account setup instructions
  } catch (error) {
    console.error("Error handling successful payment:", error);
  }
}
