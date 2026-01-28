/**
 * Entitlement Tier Mapping
 *
 * IMPORTANT: "Founders" is NOT a tier. Founders is a billing promise (lifetime access).
 * Tiers are feature tiers: maker, pro, education, enterprise.
 * A "Founder Pro" user has: tier=pro, isLifetime=true.
 *
 * This is the canonical source of truth for mapping price IDs and purchase data
 * to entitlement tiers. Used by:
 * - Purchase flow (real-time entitlement creation)
 * - Migration/backfill scripts
 * - Future subscription handling
 *
 * Mapping signals (in priority order):
 * 1. priceId -> exact tier mapping (maker/pro/education/enterprise)
 * 2. amount -> fallback for historical purchases without priceId
 * 3. Founders window -> determines isLifetime=true (does NOT change tier)
 */

// -----------------------------------------------------------------------------
// Price ID -> Tier Mappings
// These come from:
// - frontend/src/data/pricing.ts (price_starter, price_pro)
// - backend PRICE_MAPPINGS in custom.js
// -----------------------------------------------------------------------------

/**
 * Maker tier (formerly "Hobbyist/Starter") price IDs
 * $99-100 one-time for core features
 */
const MAKER_PRICE_IDS = [
  "price_starter",
  "price_starter_test",
  // Add real Stripe price IDs here
];

/**
 * Pro tier price IDs
 * $199-200 one-time for advanced features
 */
const PRO_PRICE_IDS = [
  "price_pro",
  "price_pro_test",
  // Add real Stripe price IDs here
];

/**
 * Enterprise tier price IDs
 * Custom pricing, contact required
 */
const ENTERPRISE_PRICE_IDS = [
  "price_enterprise",
  "price_enterprise_test",
  // Add real Stripe price IDs here
];

/**
 * Education tier price IDs
 * Institutional/educational pricing
 */
const EDUCATION_PRICE_IDS = [
  // Add education-specific price IDs here
];

// -----------------------------------------------------------------------------
// Amount -> Tier Mapping (fallback for missing priceId)
// Amounts in dollars (not cents)
// -----------------------------------------------------------------------------

const AMOUNT_TIER_MAP = {
  99: "maker",
  100: "maker", // pricing.ts shows $100 for Hobbyist
  199: "pro",
  200: "pro", // pricing.ts shows $200 for Pro
  499: "enterprise",
};

// -----------------------------------------------------------------------------
// Founders Sale Window
// Purchases made during this window get isLifetime=true (NOT a different tier!)
// -----------------------------------------------------------------------------

/**
 * Default founders sale end date.
 * This MUST be a real date, not null, to prevent accidental open-ended windows.
 * Override via FOUNDERS_SALE_END_ISO environment variable if needed.
 */
const DEFAULT_FOUNDERS_SALE_END = "2026-01-11T23:59:59Z";

/**
 * Get the founders sale end date from environment or default.
 * ALWAYS returns a valid Date - never null.
 */
function getFoundersSaleEndDate() {
  const envDate = process.env.FOUNDERS_SALE_END_ISO;
  if (envDate) {
    const parsed = new Date(envDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    console.warn(`[entitlement-mapping] Invalid FOUNDERS_SALE_END_ISO: "${envDate}", using default`);
  }
  return new Date(DEFAULT_FOUNDERS_SALE_END);
}

/**
 * Founders sale window configuration
 * All purchases made during this window are "founders" = isLifetime=true
 * The TIER remains based on what they purchased (maker/pro).
 *
 * IMPORTANT: endDate MUST always be a valid Date, never null.
 * This prevents accidental open-ended founders windows.
 */
const FOUNDERS_SALE_WINDOW = {
  startDate: new Date("2024-01-01T00:00:00Z"), // Product launch
  endDate: getFoundersSaleEndDate(), // NEVER null - always a hard cutoff
};

// Runtime guard: ensure endDate is never null
if (!FOUNDERS_SALE_WINDOW.endDate || isNaN(FOUNDERS_SALE_WINDOW.endDate.getTime())) {
  throw new Error("[entitlement-mapping] FOUNDERS_SALE_WINDOW.endDate cannot be null or invalid. This is a critical configuration error.");
}

// -----------------------------------------------------------------------------
// Tier Configuration
// Defines default properties for each tier (maxDevices only - isLifetime is separate)
// -----------------------------------------------------------------------------

const TIER_CONFIG = {
  maker: {
    maxDevices: 1,
    description: "Core features for solo makers",
  },
  pro: {
    maxDevices: 1,
    description: "Advanced features for professionals",
  },
  education: {
    maxDevices: 5,
    description: "Institutional/classroom access",
  },
  enterprise: {
    maxDevices: 10,
    description: "Custom enterprise deployment",
  },
};

// -----------------------------------------------------------------------------
// Mapping Functions
// -----------------------------------------------------------------------------

/**
 * Check if a date falls within the founders sale window
 * @param {Date|string} date - The date to check
 * @returns {boolean}
 */
function isInFoundersSaleWindow(date) {
  if (!date) return false;

  const checkDate = new Date(date);
  const { startDate, endDate } = FOUNDERS_SALE_WINDOW;

  if (checkDate < startDate) return false;
  // endDate is guaranteed to be a valid Date (never null)
  if (checkDate > endDate) return false;

  return true;
}

/**
 * Map a priceId to a tier (NEVER returns "founders" - founders is not a tier!)
 * @param {string} priceId
 * @returns {string|null} tier name (maker/pro/education/enterprise) or null if not found
 */
function mapPriceIdToTier(priceId) {
  if (!priceId) return null;

  if (MAKER_PRICE_IDS.includes(priceId)) return "maker";
  if (PRO_PRICE_IDS.includes(priceId)) return "pro";
  if (ENTERPRISE_PRICE_IDS.includes(priceId)) return "enterprise";
  if (EDUCATION_PRICE_IDS.includes(priceId)) return "education";

  return null;
}

/**
 * Map an amount to a tier (fallback)
 * @param {number} amount - Amount in dollars
 * @returns {string|null} tier name or null if not found
 */
function mapAmountToTier(amount) {
  if (!amount) return null;

  // Round to handle potential floating point issues
  const roundedAmount = Math.round(amount);
  return AMOUNT_TIER_MAP[roundedAmount] || null;
}

/**
 * Determine entitlement tier and lifetime status from purchase/license data
 *
 * IMPORTANT: tier is ALWAYS a feature tier (maker/pro/education/enterprise).
 * isLifetime is determined by the founders sale window.
 * A "Founder Pro" = { tier: "pro", isLifetime: true }
 *
 * Priority for TIER:
 * 1. Explicit priceId mapping
 * 2. Amount-based fallback
 * 3. Default to "pro" with uncertain flag
 *
 * isLifetime:
 * - true if purchase date is within founders sale window
 * - false otherwise
 *
 * @param {Object} data - Purchase or license data
 * @param {string} data.priceId - Stripe price ID
 * @param {number} data.amount - Purchase amount in dollars
 * @param {Date|string} data.createdAt - Purchase date
 * @returns {Object} { tier, isLifetime, maxDevices, confidence, reason, metadata }
 */
function determineEntitlementTier(data) {
  const { priceId, amount, createdAt } = data;

  // 1. Try priceId mapping first
  let tier = mapPriceIdToTier(priceId);
  let confidence = "high";
  let reason = "priceId_match";

  // 2. If no priceId match, try amount mapping
  if (!tier) {
    tier = mapAmountToTier(amount);
    if (tier) {
      confidence = "medium";
      reason = "amount_match";
    }
  }

  // 3. Fallback to pro with uncertainty
  if (!tier) {
    tier = "pro";
    confidence = "low";
    reason = "fallback_uncertain";
  }

  // Determine isLifetime based on founders window (SEPARATE from tier!)
  const inFoundersWindow = isInFoundersSaleWindow(createdAt);
  const isLifetime = inFoundersWindow;

  // Get tier config for maxDevices
  const config = TIER_CONFIG[tier] || TIER_CONFIG.pro;

  return {
    tier,
    isLifetime,
    maxDevices: config.maxDevices,
    confidence,
    reason: isLifetime ? `${reason}_founders_lifetime` : reason,
    metadata: {
      mappingSignal: reason,
      originalPriceId: priceId || null,
      originalAmount: amount || null,
      inFoundersWindow,
      isFoundersLifetime: isLifetime,
      migrationUncertain: confidence === "low",
    },
  };
}

/**
 * Create entitlement data object from mapping result
 * @param {Object} customer - Customer record
 * @param {Object} mapping - Result from determineEntitlementTier
 * @param {Object} source - Source info (type, purchaseId, licenseKeyId, isMigration)
 * @returns {Object} Entitlement data ready for creation
 */
function createEntitlementData(customer, mapping, source = {}) {
  return {
    customer: customer.id,
    tier: mapping.tier,
    status: "active",
    isLifetime: mapping.isLifetime,
    // IMPORTANT: If isLifetime=true, expiresAt MUST be null
    expiresAt: mapping.isLifetime ? null : (source.expiresAt || null),
    maxDevices: mapping.maxDevices,
    source: source.isMigration ? "legacy_purchase" : (source.sourceType || "legacy_purchase"),
    metadata: {
      ...mapping.metadata,
      sourceType: source.type || "purchase",
      sourcePurchaseId: source.purchaseId || null,
      sourceLicenseKeyId: source.licenseKeyId || null,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Repair an entitlement that has incorrect "founders" tier
 * Returns the corrected tier based on metadata or default to "pro"
 * @param {Object} entitlement - The entitlement record with bad tier
 * @returns {Object} { tier, maxDevices } - Corrected values
 */
function repairFoundersTier(entitlement) {
  const metadata = entitlement.metadata || {};

  // Try to determine correct tier from stored metadata
  let tier = null;

  // Check originalPriceId in metadata
  if (metadata.originalPriceId) {
    tier = mapPriceIdToTier(metadata.originalPriceId);
  }

  // Fallback to originalAmount
  if (!tier && metadata.originalAmount) {
    tier = mapAmountToTier(metadata.originalAmount);
  }

  // Final fallback to pro
  if (!tier) {
    tier = "pro";
  }

  const config = TIER_CONFIG[tier] || TIER_CONFIG.pro;

  return {
    tier,
    maxDevices: config.maxDevices,
  };
}

// -----------------------------------------------------------------------------
// Trial Retirement
// -----------------------------------------------------------------------------

/**
 * Retire any active trial entitlements for a customer when they purchase a paid plan.
 * This is called after a paid entitlement becomes active.
 *
 * Behavior:
 * - Finds all trial entitlements (tier="trial") for the customer that are still active/usable
 * - Sets status="expired" and expiresAt=now so they no longer appear as usable
 * - Idempotent: calling multiple times is safe (no-op if already retired)
 * - Does NOT delete trials (preserves history/relations)
 *
 * @param {number} customerId - The customer ID whose trials should be retired
 * @param {Object} options - Additional options
 * @param {number} [options.replacedByEntitlementId] - The new paid entitlement ID (for audit)
 * @returns {Promise<{retiredCount: number, retiredIds: number[]}>}
 */
async function retireTrialsForCustomer(customerId, options = {}) {
  const { replacedByEntitlementId } = options;

  if (!customerId) {
    strapi.log.warn("[RetireTrials] No customerId provided, skipping");
    return { retiredCount: 0, retiredIds: [] };
  }

  // Find all active trial entitlements for this customer
  // "Active" means: tier=trial AND status=active
  const trialEntitlements = await strapi.entityService.findMany(
    "api::entitlement.entitlement",
    {
      filters: {
        customer: customerId,
        tier: "trial",
        status: "active",
      },
    }
  );

  if (!trialEntitlements || trialEntitlements.length === 0) {
    strapi.log.info(`[RetireTrials] No active trials found for customer ${customerId}`);
    return { retiredCount: 0, retiredIds: [] };
  }

  const now = new Date();
  const retiredIds = [];

  for (const trial of trialEntitlements) {
    // Skip if already expired (idempotency)
    if (trial.status === "expired") {
      strapi.log.info(`[RetireTrials] Trial ${trial.id} already expired, skipping`);
      continue;
    }

    // Retire the trial: set status=expired and expiresAt=now
    await strapi.entityService.update("api::entitlement.entitlement", trial.id, {
      data: {
        status: "expired",
        expiresAt: now.toISOString(),
        metadata: {
          ...(trial.metadata || {}),
          retiredReason: "replaced_by_paid",
          retiredAt: now.toISOString(),
          replacedByEntitlementId: replacedByEntitlementId || null,
        },
      },
    });

    retiredIds.push(trial.id);
    strapi.log.info(
      `[RetireTrials] Retired trial ${trial.id} for customer ${customerId}` +
        (replacedByEntitlementId ? ` (replaced by entitlement ${replacedByEntitlementId})` : "")
    );
  }

  return { retiredCount: retiredIds.length, retiredIds };
}

module.exports = {
  // Price ID arrays
  MAKER_PRICE_IDS,
  PRO_PRICE_IDS,
  ENTERPRISE_PRICE_IDS,
  EDUCATION_PRICE_IDS,

  // Configuration
  AMOUNT_TIER_MAP,
  FOUNDERS_SALE_WINDOW,
  TIER_CONFIG,
  DEFAULT_FOUNDERS_SALE_END,

  // Functions
  getFoundersSaleEndDate,
  isInFoundersSaleWindow,
  mapPriceIdToTier,
  mapAmountToTier,
  determineEntitlementTier,
  createEntitlementData,
  repairFoundersTier,
  retireTrialsForCustomer,
};
