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

      // Calculate commission using affiliate's actual rate
      const commissionRate = affiliate?.commissionRate || 0.1;
      const commissionAmount = affiliate ? (amount / 100) * commissionRate : 0;

      console.log(
        `💰 Commission calculation: ${affiliate ? affiliate.commissionRate * 100 : 0}% rate = $${commissionAmount.toFixed(2)}`,
      );

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
        ctx.status = 400;
        ctx.body = { error: "licenceKey and machineId are required" };
        return;
      }

      // Find the license by key
      const license = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: { key: licenceKey },
          limit: 1,
        },
      );

      if (!license || license.length === 0) {
        ctx.status = 404;
        ctx.body = { error: "License key not found" };
        return;
      }

      const licenseRecord = license[0];

      // Check if license is already active
      if (licenseRecord.status === "active") {
        ctx.status = 400;
        ctx.body = { error: "License is already active on another device" };
        return;
      }

      // For trial licenses, only allow one-time activation
      if (licenseRecord.typ === "trial" && licenseRecord.status !== "unused") {
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
      const updatedLicense = await strapi.entityService.update(
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

      // Get private key from environment
      const privateKey = process.env.JWT_PRIVATE_KEY;
      if (!privateKey) {
        console.error("JWT_PRIVATE_KEY not found in environment");
        ctx.status = 500;
        ctx.body = { error: "JWT private key not configured" };
        return;
      }

      // Sign JWT with RS256
      const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        noTimestamp: true, // We set iat manually
      });

      console.log(
        `✅ License activated: ${newLicenseKey} for machine: ${machineId}`,
      );

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
        } catch (error) {
          return null; // Invalid encryption/decryption
        }
      };

      const decryptedCode = decryptDeactivationCode(
        licenseRecord.deactivationCode,
        licenceKey,
      );

      if (!decryptedCode || decryptedCode !== deactivationCode) {
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

      console.log(
        `✅ License deactivated and reset: ${licenceKey} -> ${newLicenseKey}`,
      );

      ctx.status = 200;
      ctx.body = {
        success: true,
        message: "License deactivated successfully",
        newLicenseKey: newLicenseKey,
      };
    } catch (error) {
      console.error("License deactivation error:", error);
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
};
