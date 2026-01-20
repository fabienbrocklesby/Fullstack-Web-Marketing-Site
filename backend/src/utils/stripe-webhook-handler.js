"use strict";

/**
 * Stripe Webhook Handler
 *
 * Server-truth fulfillment for Stripe events.
 * This is the ONLY place that creates purchases/license-keys/entitlements from Stripe.
 *
 * Key principles:
 * 1. Signature verification ALWAYS (no dev bypass)
 * 2. Idempotency via stripe-event collection
 * 3. Out-of-order protection via lastStripeEventCreated in metadata
 * 4. Founders protection: isLifetime=true entitlements NEVER downgraded by Stripe events
 * 5. 1:1 model: each purchase gets one license-key gets one entitlement
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");
const { determineEntitlementTier } = require("./entitlement-mapping");

// -----------------------------------------------------------------------------
// Idempotency
// -----------------------------------------------------------------------------

/**
 * Check if event was already processed
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<boolean>}
 */
async function isEventProcessed(eventId) {
  const existing = await strapi.entityService.findMany(
    "api::stripe-event.stripe-event",
    { filters: { eventId } }
  );
  return existing.length > 0;
}

/**
 * Mark event as processed
 * @param {string} eventId - Stripe event ID
 * @param {string} eventType - Stripe event type
 * @param {object} payload - Event payload (stored for debugging)
 * @param {number} eventCreated - Stripe event.created timestamp
 */
async function markEventProcessed(eventId, eventType, payload = null, eventCreated = null) {
  await strapi.entityService.create("api::stripe-event.stripe-event", {
    data: {
      eventId,
      eventType,
      processedAt: new Date(),
      payload: payload ? { 
        id: payload.id, 
        object: payload.object,
        eventCreated: eventCreated || null,
      } : null,
    },
  });
}

// -----------------------------------------------------------------------------
// Out-of-Order Protection
// -----------------------------------------------------------------------------

/**
 * Get lastStripeEventCreated from entitlement metadata
 * @param {object} entitlement
 * @returns {number|null}
 */
function getLastStripeEventCreated(entitlement) {
  return entitlement?.metadata?.lastStripeEventCreated || null;
}

/**
 * Check if this event is newer than the last processed event for this entitlement
 * @param {number} eventCreated - Stripe event.created timestamp
 * @param {object} entitlement
 * @returns {boolean} true if this event should be applied
 */
function shouldApplyEvent(eventCreated, entitlement) {
  const lastCreated = getLastStripeEventCreated(entitlement);
  if (!lastCreated) return true;
  return eventCreated > lastCreated;
}

// -----------------------------------------------------------------------------
// Helper: Generate License Key
// -----------------------------------------------------------------------------

function generateLicenseKey(productName, customerId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomString = crypto.randomBytes(8).toString("hex").toUpperCase();
  const productCode = (productName || "PRD").substring(0, 3).toUpperCase();
  const customerCode = (customerId?.toString() || "0000").substring(0, 4);
  return `${productCode}-${customerCode}-${timestamp}-${randomString}`;
}

// -----------------------------------------------------------------------------
// Helper: Find or Create Stripe Customer Link
// -----------------------------------------------------------------------------

/**
 * Ensure Strapi customer has stripeCustomerId linked
 * @param {number} strapiCustomerId
 * @param {string} stripeCustomerId
 */
async function linkStripeCustomer(strapiCustomerId, stripeCustomerId) {
  if (!strapiCustomerId || !stripeCustomerId) return;

  const customer = await strapi.entityService.findOne(
    "api::customer.customer",
    strapiCustomerId
  );

  if (customer && !customer.stripeCustomerId) {
    await strapi.entityService.update(
      "api::customer.customer",
      strapiCustomerId,
      { data: { stripeCustomerId } }
    );
    strapi.log.info(
      `Linked Stripe customer ${stripeCustomerId} to Strapi customer ${strapiCustomerId}`
    );
  }
}

/**
 * Find Strapi customer by Stripe customer ID
 * @param {string} stripeCustomerId
 * @returns {Promise<object|null>}
 */
async function findCustomerByStripeId(stripeCustomerId) {
  if (!stripeCustomerId) return null;

  const customers = await strapi.entityService.findMany(
    "api::customer.customer",
    { filters: { stripeCustomerId } }
  );
  return customers[0] || null;
}

/**
 * Find Strapi customer by email
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findCustomerByEmail(email) {
  if (!email) return null;

  const customers = await strapi.entityService.findMany(
    "api::customer.customer",
    { filters: { email } }
  );
  return customers[0] || null;
}

// -----------------------------------------------------------------------------
// Helper: Find Affiliate
// -----------------------------------------------------------------------------

async function findAffiliate(affiliateCode) {
  if (!affiliateCode) return null;

  const affiliates = await strapi.entityService.findMany(
    "api::affiliate.affiliate",
    { filters: { code: affiliateCode, isActive: true } }
  );
  return affiliates[0] || null;
}

// -----------------------------------------------------------------------------
// Unified Subscription Update Logic
// -----------------------------------------------------------------------------

/**
 * Map Stripe subscription status to our entitlement status
 * @param {string} stripeStatus
 * @returns {string}
 */
function mapStripeStatusToEntitlementStatus(stripeStatus) {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "inactive";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

/**
 * Apply Stripe subscription state to an entitlement
 * This is the single source of truth for subscription → entitlement mapping
 * 
 * @param {object} subscription - Stripe subscription object
 * @param {object} entitlement - Strapi entitlement record
 * @param {number} eventCreated - Stripe event.created timestamp for out-of-order protection
 * @returns {Promise<{applied: boolean, entitlement: object, reason?: string}>}
 */
async function applyStripeSubscriptionToEntitlement(subscription, entitlement, eventCreated) {
  // FOUNDERS PROTECTION: Never modify lifetime entitlements
  if (entitlement.isLifetime) {
    strapi.log.info(
      `[Webhook] Entitlement ${entitlement.id} is LIFETIME - preserving status (event=${eventCreated})`
    );
    return { applied: false, entitlement, reason: "lifetime_protected" };
  }

  // Out-of-order protection: skip if this event is older than what we've already processed
  if (!shouldApplyEvent(eventCreated, entitlement)) {
    strapi.log.info(
      `[Webhook] Skipping out-of-order event for entitlement ${entitlement.id}: ` +
      `event.created=${eventCreated} <= lastStripeEventCreated=${getLastStripeEventCreated(entitlement)}`
    );
    return { applied: false, entitlement, reason: "out_of_order" };
  }

  // Extract subscription data
  const status = mapStripeStatusToEntitlementStatus(subscription.status);
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  const priceId = subscription.items?.data?.[0]?.price?.id;

  // Update entitlement with subscription state
  const updatedEntitlement = await strapi.entityService.update(
    "api::entitlement.entitlement",
    entitlement.id,
    {
      data: {
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        expiresAt: cancelAtPeriodEnd ? currentPeriodEnd : null,
        stripePriceId: priceId || entitlement.stripePriceId,
        stripeCustomerId: subscription.customer || entitlement.stripeCustomerId,
        // Store lastStripeEventCreated in metadata for out-of-order protection
        metadata: {
          ...(entitlement.metadata || {}),
          lastStripeEventCreated: eventCreated,
          lastStripeEventAt: new Date().toISOString(),
        },
      },
    }
  );

  strapi.log.info(
    `[Webhook] Applied subscription ${subscription.id} to entitlement ${entitlement.id}: ` +
    `status=${status}, cancelAtPeriodEnd=${cancelAtPeriodEnd}, event.created=${eventCreated}`
  );

  return { applied: true, entitlement: updatedEntitlement };
}

/**
 * Find entitlement by subscription ID
 * @param {string} subscriptionId
 * @returns {Promise<object|null>}
 */
async function findEntitlementBySubscriptionId(subscriptionId) {
  const entitlements = await strapi.entityService.findMany(
    "api::entitlement.entitlement",
    { filters: { stripeSubscriptionId: subscriptionId } }
  );
  return entitlements[0] || null;
}

// -----------------------------------------------------------------------------
// Price ID to Tier Mapping
// -----------------------------------------------------------------------------

/**
 * Get tier from Stripe price ID using env-based mapping
 * Env var naming:
 *   - STRIPE_PRICE_MAKER_MONTHLY, STRIPE_PRICE_PRO_MONTHLY (subscription)
 *   - STRIPE_PRICE_ID_MAKER_ONETIME, STRIPE_PRICE_ID_PRO_ONETIME (one-time)
 */
function getTierFromPriceId(priceId) {
  if (!priceId) return "pro"; // fallback

  // Environment-based price ID mapping (aligned with stripe-pricing.js)
  const makerOneTime = process.env.STRIPE_PRICE_ID_MAKER_ONETIME;
  const proOneTime = process.env.STRIPE_PRICE_ID_PRO_ONETIME;
  // Subscription prices - note naming matches env vars actually set
  const makerSubMonthly = process.env.STRIPE_PRICE_MAKER_MONTHLY;
  const proSubMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const makerSubYearly = process.env.STRIPE_PRICE_MAKER_YEARLY;
  const proSubYearly = process.env.STRIPE_PRICE_PRO_YEARLY;

  // Check maker prices
  if (
    priceId === makerOneTime ||
    priceId === makerSubMonthly ||
    priceId === makerSubYearly ||
    priceId === "price_starter" ||
    priceId === "price_starter_test"
  ) {
    return "maker";
  }

  // Check pro prices
  if (
    priceId === proOneTime ||
    priceId === proSubMonthly ||
    priceId === proSubYearly ||
    priceId === "price_pro" ||
    priceId === "price_pro_test"
  ) {
    return "pro";
  }

  // Use entitlement-mapping fallback
  const mapping = determineEntitlementTier({
    priceId,
    amount: null,
    createdAt: new Date(),
  });
  return mapping.tier;
}

// -----------------------------------------------------------------------------
// Event Handlers
// -----------------------------------------------------------------------------

/**
 * Handle checkout.session.completed
 * Creates: Purchase, License-Key, Entitlement
 */
async function handleCheckoutSessionCompleted(session) {
  const sessionId = session.id;
  const mode = session.mode; // "payment" or "subscription"
  const customerEmail = session.customer_details?.email || session.customer_email;
  const stripeCustomerId = session.customer;
  const paymentIntentId = session.payment_intent;
  const subscriptionId = session.subscription;

  // Get metadata we passed when creating the session
  const metadata = session.metadata || {};
  const strapiCustomerId = metadata.customerId ? parseInt(metadata.customerId, 10) : null;
  const affiliateCode = metadata.affiliateCode;
  const tier = metadata.tier || getTierFromPriceId(metadata.priceId);

  strapi.log.info(
    `[Webhook] checkout.session.completed: sessionId=${sessionId}, mode=${mode}, tier=${tier}, ` +
    `email=${customerEmail}, strapiCustomerId=${strapiCustomerId}, subscriptionId=${subscriptionId || "none"}`
  );

  // Check if purchase already exists (idempotency at purchase level)
  const existingPurchases = await strapi.entityService.findMany(
    "api::purchase.purchase",
    { filters: { stripeSessionId: sessionId } }
  );

  if (existingPurchases.length > 0) {
    strapi.log.info(`[Webhook] Purchase already exists for session ${sessionId}, skipping`);
    return { alreadyProcessed: true, purchaseId: existingPurchases[0].id };
  }

  // Find or identify customer
  let customer = null;
  if (strapiCustomerId) {
    customer = await strapi.entityService.findOne(
      "api::customer.customer",
      strapiCustomerId
    );
  }
  if (!customer && stripeCustomerId) {
    customer = await findCustomerByStripeId(stripeCustomerId);
  }
  if (!customer && customerEmail) {
    customer = await findCustomerByEmail(customerEmail);
  }

  if (!customer) {
    strapi.log.warn(
      `[Webhook] No customer found for session ${sessionId}. ` +
        `Email: ${customerEmail}, StripeCustomerId: ${stripeCustomerId}`
    );
    // We still create the purchase but without customer link
  }

  // Link Stripe customer ID if we have both
  if (customer && stripeCustomerId) {
    await linkStripeCustomer(customer.id, stripeCustomerId);
  }

  // Get line items to extract price info
  let priceId = metadata.priceId;
  let amount = 0;
  let productName = tier;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    if (lineItems.data.length > 0) {
      const firstItem = lineItems.data[0];
      priceId = priceId || firstItem.price?.id;
      amount = firstItem.amount_total || 0;
      productName = firstItem.description || productName;
    }
  } catch (err) {
    strapi.log.warn(`[Webhook] Could not fetch line items: ${err.message}`);
  }

  // Calculate commission if affiliate exists
  const affiliate = await findAffiliate(affiliateCode);
  const commissionRate = affiliate?.commissionRate || 0.1;
  const commissionAmount = affiliate ? (amount / 100) * commissionRate : 0;

  // Determine if this is a founders purchase (lifetime)
  const tierMapping = determineEntitlementTier({
    priceId: priceId || `price_${tier}`,
    amount: amount / 100,
    createdAt: new Date(),
  });

  // For subscriptions, fetch subscription object to get period details
  let subscriptionDetails = null;
  if (mode === "subscription" && subscriptionId) {
    try {
      subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (subErr) {
      strapi.log.warn(`[Webhook] Could not fetch subscription ${subscriptionId}: ${subErr.message}`);
    }
  }

  // Create Purchase
  const purchase = await strapi.entityService.create("api::purchase.purchase", {
    data: {
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId || null,
      stripeInvoiceId: null,
      stripeSubscriptionId: subscriptionId || null,
      mode: mode === "subscription" ? "subscription" : "payment",
      amount: amount / 100,
      currency: session.currency || "usd",
      customerEmail,
      priceId: priceId || `price_${tier}`,
      customer: customer?.id || null,
      affiliate: affiliate?.id || null,
      commissionAmount,
      metadata: {
        processedVia: "stripe-webhook",
        sessionMode: mode,
        timestamp: new Date().toISOString(),
      },
    },
  });

  strapi.log.info(`[Webhook] Created purchase ${purchase.id} for session ${sessionId}`);

  // Create License Key
  const licenseKey = generateLicenseKey(productName, customer?.id);
  const licenseKeyRecord = await strapi.entityService.create(
    "api::license-key.license-key",
    {
      data: {
        key: licenseKey,
        productName: productName,
        priceId: priceId || `price_${tier}`,
        customer: customer?.id || null,
        purchase: purchase.id,
        status: "unused",
        isActive: true,
        isUsed: false,
        maxActivations: 1,
        currentActivations: 0,
      },
    }
  );

  strapi.log.info(`[Webhook] Created license-key ${licenseKeyRecord.id}: ${licenseKey}`);

  // Link license key to purchase
  await strapi.entityService.update("api::purchase.purchase", purchase.id, {
    data: { licenseKey: licenseKeyRecord.id },
  });

  // Create Entitlement
  const isSubscription = mode === "subscription";

  // Extract subscription period details if available
  let currentPeriodEnd = null;
  let cancelAtPeriodEnd = false;
  if (subscriptionDetails) {
    currentPeriodEnd = subscriptionDetails.current_period_end
      ? new Date(subscriptionDetails.current_period_end * 1000)
      : null;
    cancelAtPeriodEnd = subscriptionDetails.cancel_at_period_end || false;
  }

  const entitlement = await strapi.entityService.create(
    "api::entitlement.entitlement",
    {
      data: {
        customer: customer?.id || null,
        licenseKey: licenseKeyRecord.id,
        purchase: purchase.id,
        tier: tierMapping.tier,
        status: "active",
        isLifetime: isSubscription ? false : tierMapping.isLifetime,
        expiresAt: null,
        maxDevices: tierMapping.maxDevices,
        source: isSubscription ? "subscription" : "legacy_purchase",
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: subscriptionId || null,
        stripePriceId: priceId || null,
        currentPeriodEnd: currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        metadata: {
          ...tierMapping.metadata,
          sourceType: isSubscription ? "subscription_checkout" : "payment_checkout",
          sourcePurchaseId: purchase.id,
          sourceLicenseKeyId: licenseKeyRecord.id,
          createdAt: new Date().toISOString(),
        },
      },
    }
  );

  strapi.log.info(
    `[Webhook] Created entitlement ${entitlement.id}, tier=${tierMapping.tier}, ` +
      `lifetime=${entitlement.isLifetime}, source=${entitlement.source}` +
      (isSubscription ? `, subscription=${subscriptionId}` : "")
  );

  // Update affiliate earnings
  if (affiliate && commissionAmount > 0) {
    await strapi.entityService.update(
      "api::affiliate.affiliate",
      affiliate.id,
      {
        data: {
          totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
        },
      }
    );
    strapi.log.info(`[Webhook] Updated affiliate ${affiliate.code} earnings: +$${commissionAmount.toFixed(2)}`);
  }

  return {
    purchaseId: purchase.id,
    licenseKeyId: licenseKeyRecord.id,
    entitlementId: entitlement.id,
  };
}

/**
 * Handle customer.subscription.created
 * Updates entitlement with subscription details using unified logic
 */
async function handleSubscriptionCreated(subscription, eventCreated) {
  strapi.log.info(
    `[Webhook] subscription.created: ${subscription.id}, event.created=${eventCreated}`
  );

  const entitlement = await findEntitlementBySubscriptionId(subscription.id);

  if (!entitlement) {
    strapi.log.warn(`[Webhook] No entitlement found for subscription ${subscription.id}`);
    return { applied: false, reason: "no_entitlement" };
  }

  const result = await applyStripeSubscriptionToEntitlement(subscription, entitlement, eventCreated);
  return result;
}

/**
 * Handle customer.subscription.updated
 * Updates entitlement status, period end, cancel flag using unified logic
 */
async function handleSubscriptionUpdated(subscription, eventCreated) {
  strapi.log.info(
    `[Webhook] subscription.updated: ${subscription.id}, status=${subscription.status}, event.created=${eventCreated}`
  );

  const entitlement = await findEntitlementBySubscriptionId(subscription.id);

  if (!entitlement) {
    strapi.log.warn(`[Webhook] No entitlement found for subscription ${subscription.id}`);
    return { applied: false, reason: "no_entitlement" };
  }

  const result = await applyStripeSubscriptionToEntitlement(subscription, entitlement, eventCreated);
  return result;
}

/**
 * Handle customer.subscription.deleted
 * Sets entitlement to canceled (unless lifetime) using unified logic
 */
async function handleSubscriptionDeleted(subscription, eventCreated) {
  strapi.log.info(
    `[Webhook] subscription.deleted: ${subscription.id}, event.created=${eventCreated}`
  );

  const entitlement = await findEntitlementBySubscriptionId(subscription.id);

  if (!entitlement) {
    strapi.log.warn(`[Webhook] No entitlement found for subscription ${subscription.id}`);
    return { applied: false, reason: "no_entitlement" };
  }

  // FOUNDERS PROTECTION: Never cancel lifetime entitlements
  if (entitlement.isLifetime) {
    strapi.log.info(
      `[Webhook] Entitlement ${entitlement.id} is LIFETIME - NOT canceling despite subscription deletion`
    );
    return { applied: false, reason: "lifetime_protected" };
  }

  // Out-of-order protection
  if (!shouldApplyEvent(eventCreated, entitlement)) {
    strapi.log.info(
      `[Webhook] Skipping out-of-order delete event for entitlement ${entitlement.id}: ` +
      `event.created=${eventCreated} <= lastStripeEventCreated=${getLastStripeEventCreated(entitlement)}`
    );
    return { applied: false, reason: "out_of_order" };
  }

  const updatedEntitlement = await strapi.entityService.update(
    "api::entitlement.entitlement",
    entitlement.id,
    {
      data: {
        status: "canceled",
        cancelAtPeriodEnd: true,
        metadata: {
          ...(entitlement.metadata || {}),
          lastStripeEventCreated: eventCreated,
          lastStripeEventAt: new Date().toISOString(),
          canceledByEvent: "subscription.deleted",
        },
      },
    }
  );

  strapi.log.info(
    `[Webhook] Canceled entitlement ${entitlement.id} (subscription ${subscription.id})`
  );

  return { applied: true, entitlement: updatedEntitlement };
}

/**
 * Handle invoice.payment_succeeded
 * Reactivates entitlement if payment was successful
 */
async function handleInvoicePaymentSucceeded(invoice, eventCreated) {
  strapi.log.info(
    `[Webhook] invoice.payment_succeeded: ${invoice.id}, event.created=${eventCreated}`
  );

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    strapi.log.debug("[Webhook] Invoice has no subscription, likely one-time payment");
    return { applied: false, reason: "no_subscription" };
  }

  const entitlement = await findEntitlementBySubscriptionId(subscriptionId);

  if (!entitlement) {
    strapi.log.warn(`[Webhook] No entitlement found for subscription ${subscriptionId}`);
    return { applied: false, reason: "no_entitlement" };
  }

  // FOUNDERS PROTECTION
  if (entitlement.isLifetime) {
    strapi.log.info(
      `[Webhook] Entitlement ${entitlement.id} is lifetime, skipping invoice update`
    );
    return { applied: false, reason: "lifetime_protected" };
  }

  // Out-of-order protection
  if (!shouldApplyEvent(eventCreated, entitlement)) {
    strapi.log.info(
      `[Webhook] Skipping out-of-order payment event for entitlement ${entitlement.id}`
    );
    return { applied: false, reason: "out_of_order" };
  }

  // Ensure entitlement is active after successful payment
  if (entitlement.status !== "active") {
    await strapi.entityService.update(
      "api::entitlement.entitlement",
      entitlement.id,
      {
        data: {
          status: "active",
          metadata: {
            ...(entitlement.metadata || {}),
            lastStripeEventCreated: eventCreated,
            lastStripeEventAt: new Date().toISOString(),
            reactivatedByEvent: "invoice.payment_succeeded",
          },
        },
      }
    );
    strapi.log.info(
      `[Webhook] Reactivated entitlement ${entitlement.id} after payment`
    );
    return { applied: true, action: "reactivated" };
  }

  // Update purchase with invoice ID if we can find it
  const purchases = await strapi.entityService.findMany(
    "api::purchase.purchase",
    { filters: { stripeSubscriptionId: subscriptionId } }
  );

  if (purchases.length > 0 && !purchases[0].stripeInvoiceId) {
    await strapi.entityService.update(
      "api::purchase.purchase",
      purchases[0].id,
      { data: { stripeInvoiceId: invoice.id } }
    );
  }

  return { applied: true, action: "invoice_linked" };
}

/**
 * Handle invoice.payment_failed
 * Marks entitlement as inactive (unless lifetime)
 */
async function handleInvoicePaymentFailed(invoice, eventCreated) {
  strapi.log.info(
    `[Webhook] invoice.payment_failed: ${invoice.id}, event.created=${eventCreated}`
  );

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    return { applied: false, reason: "no_subscription" };
  }

  const entitlement = await findEntitlementBySubscriptionId(subscriptionId);

  if (!entitlement) {
    strapi.log.warn(`[Webhook] No entitlement found for subscription ${subscriptionId}`);
    return { applied: false, reason: "no_entitlement" };
  }

  // FOUNDERS PROTECTION
  if (entitlement.isLifetime) {
    strapi.log.info(
      `[Webhook] Entitlement ${entitlement.id} is lifetime, ignoring payment failure`
    );
    return { applied: false, reason: "lifetime_protected" };
  }

  // Out-of-order protection
  if (!shouldApplyEvent(eventCreated, entitlement)) {
    strapi.log.info(
      `[Webhook] Skipping out-of-order payment failure for entitlement ${entitlement.id}`
    );
    return { applied: false, reason: "out_of_order" };
  }

  // Mark as inactive due to payment failure
  await strapi.entityService.update(
    "api::entitlement.entitlement",
    entitlement.id,
    {
      data: {
        status: "inactive",
        metadata: {
          ...(entitlement.metadata || {}),
          lastStripeEventCreated: eventCreated,
          lastStripeEventAt: new Date().toISOString(),
          deactivatedByEvent: "invoice.payment_failed",
        },
      },
    }
  );

  strapi.log.warn(
    `[Webhook] Marked entitlement ${entitlement.id} as inactive due to payment failure`
  );

  return { applied: true, action: "deactivated" };
}

// -----------------------------------------------------------------------------
// Main Event Router
// -----------------------------------------------------------------------------

/**
 * Process a verified Stripe event
 * @param {object} event - Verified Stripe event object
 * @returns {Promise<object>} Processing result
 */
async function processStripeEvent(event) {
  const eventId = event.id;
  const eventType = event.type;
  const eventCreated = event.created; // Unix timestamp for out-of-order protection

  strapi.log.info(
    `[Webhook] Processing event: type=${eventType}, id=${eventId}, created=${eventCreated}`
  );

  // Check idempotency
  if (await isEventProcessed(eventId)) {
    strapi.log.info(`[Webhook] Event ${eventId} already processed, skipping`);
    return { status: "already_processed", eventId };
  }

  let result = { status: "processed", eventId, eventType, eventCreated };

  try {
    switch (eventType) {
      case "checkout.session.completed":
        result.data = await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "customer.subscription.created":
        result.data = await handleSubscriptionCreated(event.data.object, eventCreated);
        break;

      case "customer.subscription.updated":
        result.data = await handleSubscriptionUpdated(event.data.object, eventCreated);
        break;

      case "customer.subscription.deleted":
        result.data = await handleSubscriptionDeleted(event.data.object, eventCreated);
        break;

      case "invoice.payment_succeeded":
        result.data = await handleInvoicePaymentSucceeded(event.data.object, eventCreated);
        break;

      case "invoice.payment_failed":
        result.data = await handleInvoicePaymentFailed(event.data.object, eventCreated);
        break;

      default:
        strapi.log.debug(`[Webhook] Unhandled event type: ${eventType}`);
        result.status = "unhandled";
    }

    // Mark event as processed with eventCreated for tracking
    await markEventProcessed(eventId, eventType, event.data?.object, eventCreated);
  } catch (err) {
    strapi.log.error(`[Webhook] Error processing ${eventType}: ${err.message}`);
    strapi.log.error(err.stack);
    throw err;
  }

  return result;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

module.exports = {
  processStripeEvent,
  isEventProcessed,
  markEventProcessed,
  getTierFromPriceId,
  generateLicenseKey,
  findCustomerByEmail,
  findCustomerByStripeId,
};
