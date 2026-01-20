"use strict";

/**
 * Stripe Pricing Helper
 *
 * Resolves Stripe Product IDs to active monthly recurring Price IDs.
 * Uses in-memory caching to avoid hitting Stripe API on every request.
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// In-memory cache: productId -> { priceId, cachedAt }
const priceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a monthly recurring price ID for a given product ID.
 *
 * Strategy:
 * 1. Check in-memory cache first
 * 2. Try product.default_price if it's a recurring monthly price
 * 3. Otherwise, list all active prices and find the best monthly match
 *
 * @param {string} productId - Stripe Product ID (e.g., prod_TmAqKbxCS18Txx)
 * @returns {Promise<string>} - Stripe Price ID
 * @throws {Error} - If no valid monthly recurring price found
 */
async function getMonthlyRecurringPriceIdForProduct(productId) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  // Check cache
  const cached = priceCache.get(productId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    strapi.log.debug(`[StripePricing] Cache hit for product ${productId}: ${cached.priceId}`);
    return cached.priceId;
  }

  strapi.log.info(`[StripePricing] Resolving price for product ${productId}`);

  try {
    // Try default_price first
    const product = await stripe.products.retrieve(productId, {
      expand: ["default_price"],
    });

    if (product.default_price && typeof product.default_price === "object") {
      const defaultPrice = product.default_price;

      // Check if default_price is a valid monthly recurring price
      if (
        defaultPrice.active &&
        defaultPrice.type === "recurring" &&
        defaultPrice.recurring?.interval === "month"
      ) {
        strapi.log.info(
          `[StripePricing] Using default_price ${defaultPrice.id} for product ${productId}`
        );
        priceCache.set(productId, { priceId: defaultPrice.id, cachedAt: Date.now() });
        return defaultPrice.id;
      }
    }

    // default_price not suitable, list all prices
    strapi.log.info(
      `[StripePricing] default_price not valid for ${productId}, listing prices...`
    );

    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });

    // Filter for monthly recurring prices
    const monthlyPrices = prices.data.filter((price) => {
      return (
        price.type === "recurring" &&
        price.recurring?.interval === "month" &&
        (!price.recurring?.usage_type || price.recurring.usage_type === "licensed")
      );
    });

    if (monthlyPrices.length === 0) {
      throw new Error(
        `No active monthly recurring price found for product ${productId}. ` +
          `Create a recurring monthly price in Stripe Dashboard.`
      );
    }

    // Sort by created date (most recent first) and pick the first
    monthlyPrices.sort((a, b) => b.created - a.created);
    const selectedPrice = monthlyPrices[0];

    strapi.log.info(
      `[StripePricing] Selected price ${selectedPrice.id} (of ${monthlyPrices.length} options) for product ${productId}`
    );

    // Cache the result
    priceCache.set(productId, { priceId: selectedPrice.id, cachedAt: Date.now() });

    return selectedPrice.id;
  } catch (error) {
    // Don't cache errors
    if (error.type === "StripeInvalidRequestError") {
      throw new Error(`Invalid Stripe product ID: ${productId}. ${error.message}`);
    }
    throw error;
  }
}

/**
 * Clear the price cache (useful for testing)
 */
function clearPriceCache() {
  priceCache.clear();
  strapi.log.info("[StripePricing] Cache cleared");
}

/**
 * Get tier from product ID using env mapping
 * @param {string} productId
 * @returns {'maker' | 'pro' | null}
 */
function getTierFromProductId(productId) {
  if (!productId) return null;

  const makerProductId = process.env.STRIPE_PRODUCT_ID_MAKER;
  const proProductId = process.env.STRIPE_PRODUCT_ID_PRO;

  if (productId === makerProductId) return "maker";
  if (productId === proProductId) return "pro";

  return null;
}

/**
 * Get product ID from tier using env mapping
 * @param {'maker' | 'pro'} tier
 * @returns {string | null}
 */
function getProductIdFromTier(tier) {
  if (tier === "maker") return process.env.STRIPE_PRODUCT_ID_MAKER || null;
  if (tier === "pro") return process.env.STRIPE_PRODUCT_ID_PRO || null;
  return null;
}

/**
 * Normalize tier/plan key aliases to canonical tier names.
 * - "hobbyists", "starter", "hobbyist" → "maker"
 * - "pro" stays "pro"
 * @param {string} planKey
 * @returns {'maker' | 'pro' | null}
 */
function normalizeTierKey(planKey) {
  if (!planKey) return null;
  const key = planKey.toLowerCase().trim();
  if (["hobbyists", "hobbyist", "starter", "maker"].includes(key)) {
    return "maker";
  }
  if (key === "pro") {
    return "pro";
  }
  return null;
}

/**
 * Get subscription price ID for a given plan key.
 * This is the primary function for subscription checkout.
 *
 * Accepts tier aliases (hobbyists, starter → maker) and returns
 * the corresponding Stripe Price ID from environment variables.
 *
 * Environment variables:
 * - STRIPE_PRICE_MAKER_MONTHLY (renamed from Hobbyists)
 * - STRIPE_PRICE_PRO_MONTHLY
 *
 * @param {string} planKey - Plan key (maker, pro, hobbyists, starter)
 * @returns {string} Stripe Price ID (price_...)
 * @throws {Error} If plan key is invalid or env var is missing
 */
function getSubscriptionPriceId(planKey) {
  const tier = normalizeTierKey(planKey);
  if (!tier) {
    throw new Error(
      `Invalid plan key: "${planKey}". Valid keys: maker, pro, hobbyists, starter`
    );
  }

  const envVarMap = {
    maker: "STRIPE_PRICE_MAKER_MONTHLY",
    pro: "STRIPE_PRICE_PRO_MONTHLY",
  };

  const envVarName = envVarMap[tier];
  const priceId = process.env[envVarName];

  if (!priceId) {
    throw new Error(
      `Missing environment variable: ${envVarName}. ` +
        `Set this to a Stripe Price ID (price_...) for the ${tier} monthly subscription.`
    );
  }

  return priceId;
}

module.exports = {
  getMonthlyRecurringPriceIdForProduct,
  clearPriceCache,
  getTierFromProductId,
  getProductIdFromTier,
  normalizeTierKey,
  getSubscriptionPriceId,
};
