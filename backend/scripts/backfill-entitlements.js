#!/usr/bin/env node
/**
 * Backfill Entitlements Migration Script (Per-License)
 *
 * Creates ONE entitlement per license-key. Each license-key MUST have
 * exactly one entitlement (1:1 relationship). Customers can have multiple
 * entitlements if they own multiple licenses.
 *
 * Usage:
 *   node scripts/backfill-entitlements.js --dry-run
 *   node scripts/backfill-entitlements.js --apply
 *   node scripts/backfill-entitlements.js --dry-run --limit 10
 *   node scripts/backfill-entitlements.js --dry-run --verbose
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --apply      Actually create entitlement records
 *   --limit N    Process only N license-keys (for testing)
 *   --verbose    Show detailed per-license output
 */

const { determineEntitlementTier, TIER_CONFIG } = require("../src/utils/entitlement-mapping");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isApply = args.includes("--apply");
const isVerbose = args.includes("--verbose");

const limitIndex = args.indexOf("--limit");
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

// Validate arguments
if (!isDryRun && !isApply) {
  console.error("Error: Must specify either --dry-run or --apply");
  console.error("");
  console.error("Usage:");
  console.error("  node scripts/backfill-entitlements.js --dry-run");
  console.error("  node scripts/backfill-entitlements.js --apply");
  console.error("  node scripts/backfill-entitlements.js --dry-run --limit 10");
  console.error("  node scripts/backfill-entitlements.js --dry-run --verbose");
  process.exit(1);
}

if (isDryRun && isApply) {
  console.error("Error: Cannot specify both --dry-run and --apply");
  process.exit(1);
}

// Stats tracking
const stats = {
  licenseKeysScanned: 0,
  entitlementsCreated: 0,
  entitlementsSkippedExisting: 0,
  entitlementsByTier: {
    maker: 0,
    pro: 0,
    education: 0,
    enterprise: 0,
  },
  foundersLifetime: 0,
  uncertainMappings: 0,
  errors: [],
};

/**
 * Main migration function
 */
async function runMigration(strapi) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ENTITLEMENT BACKFILL MIGRATION (Per-License)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "APPLY (will create records)"}`);
  if (limit) console.log(`Limit: ${limit} license-keys`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("");
  console.log("This script creates ONE entitlement per license-key (1:1).");
  console.log("Customers with multiple licenses will have multiple entitlements.");
  console.log("");

  // Build query - fetch all license-keys with their purchase and customer
  const licenseKeyQuery = {
    populate: ["purchase", "customer", "entitlement"],
    sort: { createdAt: "asc" },
  };

  if (limit) {
    licenseKeyQuery.pagination = { limit };
  }

  console.log("Fetching license-keys...");
  const licenseKeys = await strapi.entityService.findMany(
    "api::license-key.license-key",
    licenseKeyQuery
  );

  stats.licenseKeysScanned = licenseKeys.length;
  console.log(`Found ${licenseKeys.length} license-keys to process\n`);

  // Process each license-key
  for (const licenseKey of licenseKeys) {
    await processLicenseKey(strapi, licenseKey);
  }

  // Print summary
  printSummary();

  return stats;
}

/**
 * Process a single license-key and create its entitlement
 */
async function processLicenseKey(strapi, licenseKey) {
  // Skip if already has entitlement
  if (licenseKey.entitlement) {
    stats.entitlementsSkippedExisting++;
    if (isVerbose) {
      console.log(`  [SKIP] License #${licenseKey.id}: Already has entitlement #${licenseKey.entitlement.id}`);
    }
    return;
  }

  // Must have a customer
  if (!licenseKey.customer) {
    if (isVerbose) {
      console.log(`  [SKIP] License #${licenseKey.id}: No customer linked`);
    }
    return;
  }

  const customer = licenseKey.customer;
  const purchase = licenseKey.purchase;

  // Determine tier using purchase data (preferred) or license-key fallback
  let tierMapping;
  if (purchase) {
    // Use purchase data - most accurate
    tierMapping = determineEntitlementTier({
      priceId: purchase.priceId || licenseKey.priceId,
      amount: parseFloat(purchase.amount) || null,
      createdAt: purchase.createdAt || licenseKey.createdAt,
      metadata: purchase.metadata,
    });
  } else {
    // Fallback to license-key data
    tierMapping = determineEntitlementTier({
      priceId: licenseKey.priceId,
      amount: null,
      createdAt: licenseKey.createdAt,
      metadata: null,
    });
  }

  // Additional fallback: map licenseKey.typ to tier if mapping uncertain
  if (tierMapping.confidence === "low" && licenseKey.typ) {
    const typToTier = {
      starter: "maker",
      pro: "pro",
      enterprise: "enterprise",
      paid: "maker", // Default paid to maker
      trial: "maker",
    };
    const mappedTier = typToTier[licenseKey.typ];
    if (mappedTier && TIER_CONFIG[mappedTier]) {
      tierMapping.tier = mappedTier;
      tierMapping.maxDevices = TIER_CONFIG[mappedTier].maxDevices;
      tierMapping.reason = `${tierMapping.reason}_typ_fallback`;
      tierMapping.metadata.typFallback = licenseKey.typ;
    }
  }

  // Track uncertain mappings
  if (tierMapping.confidence === "low") {
    stats.uncertainMappings++;
  }

  if (isVerbose || !isDryRun) {
    console.log(`  [${isDryRun ? "WOULD CREATE" : "CREATE"}] License #${licenseKey.id} (${licenseKey.key?.substring(0, 15)}...)`);
    console.log(`    Customer: #${customer.id} (${customer.email})`);
    console.log(`    Tier: ${tierMapping.tier} (${tierMapping.confidence} confidence)`);
    console.log(`    Lifetime: ${tierMapping.isLifetime}${tierMapping.isLifetime ? " (Founders)" : ""}`);
    console.log(`    Source: ${purchase ? `purchase #${purchase.id}` : "license-key only"}`);
    if (tierMapping.confidence === "low") {
      console.log(`    ⚠️  Uncertain mapping: ${tierMapping.reason}`);
    }
  }

  // Create the entitlement
  if (isApply) {
    try {
      const entitlementData = {
        customer: customer.id,
        licenseKey: licenseKey.id,
        purchase: purchase?.id || null,
        tier: tierMapping.tier,
        status: "active",
        isLifetime: tierMapping.isLifetime,
        expiresAt: tierMapping.isLifetime ? null : null,
        maxDevices: tierMapping.maxDevices,
        source: "legacy_purchase",
        metadata: {
          ...tierMapping.metadata,
          sourceType: purchase ? "purchase" : "license_key",
          sourcePurchaseId: purchase?.id || null,
          sourceLicenseKeyId: licenseKey.id,
          migrationScript: "backfill-entitlements.js",
          migratedAt: new Date().toISOString(),
        },
      };

      await strapi.entityService.create("api::entitlement.entitlement", {
        data: entitlementData,
      });

      stats.entitlementsCreated++;
      stats.entitlementsByTier[tierMapping.tier]++;
      if (tierMapping.isLifetime) stats.foundersLifetime++;

    } catch (error) {
      stats.errors.push({
        licenseKeyId: licenseKey.id,
        customerId: customer.id,
        error: error.message,
      });
      console.error(`    [ERROR] Failed to create entitlement: ${error.message}`);
    }
  } else {
    // Dry run - just count
    stats.entitlementsCreated++;
    stats.entitlementsByTier[tierMapping.tier]++;
    if (tierMapping.isLifetime) stats.foundersLifetime++;
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MIGRATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("License Keys:");
  console.log(`  Total scanned:        ${stats.licenseKeysScanned}`);
  console.log("");
  console.log("Entitlements:");
  console.log(`  ${isDryRun ? "Would create" : "Created"}:          ${stats.entitlementsCreated}`);
  console.log(`  Skipped (existing):   ${stats.entitlementsSkippedExisting}`);
  console.log("");
  console.log("By Tier:");
  console.log(`  Maker:                ${stats.entitlementsByTier.maker}`);
  console.log(`  Pro:                  ${stats.entitlementsByTier.pro}`);
  console.log(`  Education:            ${stats.entitlementsByTier.education}`);
  console.log(`  Enterprise:           ${stats.entitlementsByTier.enterprise}`);
  console.log("");
  console.log("Billing:");
  console.log(`  Founders (lifetime):  ${stats.foundersLifetime}`);
  console.log("");
  console.log("Quality:");
  console.log(`  Uncertain mappings:   ${stats.uncertainMappings}`);
  console.log(`  Errors:               ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    stats.errors.forEach((err) => {
      console.log(`  - License #${err.licenseKeyId} (Customer #${err.customerId}): ${err.error}`);
    });
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");

  if (isDryRun) {
    console.log("");
    console.log("This was a DRY RUN. No changes were made.");
    console.log("Run with --apply to create entitlements.");
  }
}

// -----------------------------------------------------------------------------
// Strapi Bootstrap
// -----------------------------------------------------------------------------

const Strapi = require("@strapi/strapi");

async function main() {
  let strapiInstance;

  try {
    console.log("Starting Strapi...");
    strapiInstance = await Strapi().load();

    // Run the migration
    await runMigration(strapiInstance);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    // Clean shutdown
    if (strapiInstance) {
      await strapiInstance.destroy();
    }
    process.exit(0);
  }
}

main();
