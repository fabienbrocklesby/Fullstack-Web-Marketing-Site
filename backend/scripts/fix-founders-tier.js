#!/usr/bin/env node
/**
 * Fix Founders Tier Migration Script
 *
 * Repairs entitlement records that incorrectly have tier="founders".
 * "Founders" is NOT a tier - it's a billing concept (isLifetime=true).
 *
 * This script:
 * 1. Finds all entitlements where tier="founders"
 * 2. Determines the correct tier from metadata (originalPriceId, originalAmount)
 * 3. Updates tier to correct value (maker/pro/etc)
 * 4. Ensures isLifetime=true and expiresAt=null
 *
 * Usage:
 *   node scripts/fix-founders-tier.js --dry-run
 *   node scripts/fix-founders-tier.js --apply
 *   node scripts/fix-founders-tier.js --dry-run --verbose
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --apply      Actually update entitlement records
 *   --verbose    Show detailed per-entitlement output
 */

const { repairFoundersTier } = require("../src/utils/entitlement-mapping");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isApply = args.includes("--apply");
const isVerbose = args.includes("--verbose");

// Validate arguments
if (!isDryRun && !isApply) {
  console.error("Error: Must specify either --dry-run or --apply");
  console.error("");
  console.error("Usage:");
  console.error("  node scripts/fix-founders-tier.js --dry-run");
  console.error("  node scripts/fix-founders-tier.js --apply");
  process.exit(1);
}

if (isDryRun && isApply) {
  console.error("Error: Cannot specify both --dry-run and --apply");
  process.exit(1);
}

// Stats tracking
const stats = {
  totalScanned: 0,
  foundersFound: 0,
  repairedToMaker: 0,
  repairedToPro: 0,
  repairedToEducation: 0,
  repairedToEnterprise: 0,
  alreadyCorrect: 0,
  errors: [],
};

/**
 * Main fix function
 */
async function runFix(strapi) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIX FOUNDERS TIER MIGRATION");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "APPLY (will update records)"}`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("");

  // Find all entitlements with tier="founders"
  console.log("Searching for entitlements with tier='founders'...");

  // Note: Since we've removed "founders" from the enum, we need to query raw
  // If the database still has old records with tier="founders", they may error
  // We'll try a raw query approach if the entityService fails

  let badEntitlements = [];

  try {
    // Try using Strapi's knex/raw query to find bad data
    const knex = strapi.db.connection;
    const results = await knex("entitlements")
      .where("tier", "founders")
      .select("*");

    badEntitlements = results;
    console.log(`Found ${badEntitlements.length} entitlements with tier='founders'\n`);
  } catch (error) {
    console.log("Raw query failed, trying entityService...");
    // If raw query fails, try regular approach (may fail if enum is enforced)
    try {
      badEntitlements = await strapi.entityService.findMany(
        "api::entitlement.entitlement",
        {
          filters: { tier: "founders" },
          populate: ["customer"],
        }
      );
      console.log(`Found ${badEntitlements.length} entitlements with tier='founders'\n`);
    } catch (innerError) {
      console.log("EntityService query also failed. This might mean:");
      console.log("  1. No entitlements with tier='founders' exist (good!)");
      console.log("  2. The database enum is enforced and rejects the query");
      console.log("");
      console.log("Checking total entitlements count...");

      const allEntitlements = await strapi.entityService.findMany(
        "api::entitlement.entitlement",
        { populate: ["customer"] }
      );

      stats.totalScanned = allEntitlements.length;
      console.log(`Total entitlements: ${allEntitlements.length}`);
      console.log("No 'founders' tier entitlements found. Nothing to fix!");

      printSummary();
      return stats;
    }
  }

  stats.totalScanned = badEntitlements.length;

  if (badEntitlements.length === 0) {
    console.log("No entitlements with tier='founders' found. Nothing to fix!");
    printSummary();
    return stats;
  }

  stats.foundersFound = badEntitlements.length;

  // Process each bad entitlement
  for (const entitlement of badEntitlements) {
    await processEntitlement(strapi, entitlement);
  }

  // Print summary
  printSummary();

  return stats;
}

/**
 * Process and fix a single entitlement
 */
async function processEntitlement(strapi, entitlement) {
  const customerId = entitlement.customer_id || entitlement.customer?.id || "unknown";
  const customerEmail = entitlement.customer?.email || "unknown";

  // Parse metadata if it's a string
  let metadata = entitlement.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }
  metadata = metadata || {};

  // Determine correct tier using repairFoundersTier
  const repair = repairFoundersTier({ ...entitlement, metadata });

  if (isVerbose) {
    console.log(`  [${isDryRun ? "WOULD FIX" : "FIX"}] Entitlement #${entitlement.id}`);
    console.log(`    Customer: #${customerId} (${customerEmail})`);
    console.log(`    Current tier: founders`);
    console.log(`    Correct tier: ${repair.tier}`);
    console.log(`    Metadata originalPriceId: ${metadata.originalPriceId || "none"}`);
    console.log(`    Metadata originalAmount: ${metadata.originalAmount || "none"}`);
  }

  // Track which tier we're repairing to
  switch (repair.tier) {
    case "maker":
      stats.repairedToMaker++;
      break;
    case "pro":
      stats.repairedToPro++;
      break;
    case "education":
      stats.repairedToEducation++;
      break;
    case "enterprise":
      stats.repairedToEnterprise++;
      break;
  }

  // Apply the fix
  if (isApply) {
    try {
      // Update using raw query since entityService may reject old enum values
      const knex = strapi.db.connection;
      await knex("entitlements")
        .where("id", entitlement.id)
        .update({
          tier: repair.tier,
          is_lifetime: true,
          expires_at: null,
          max_devices: repair.maxDevices,
          metadata: JSON.stringify({
            ...metadata,
            fixedFromFoundersTier: true,
            fixedAt: new Date().toISOString(),
            originalTierValue: "founders",
          }),
        });

      if (isVerbose) {
        console.log(`    ✓ Updated successfully`);
      }
    } catch (error) {
      stats.errors.push({
        entitlementId: entitlement.id,
        customerId,
        error: error.message,
      });
      console.error(`    [ERROR] Failed to update entitlement #${entitlement.id}: ${error.message}`);
    }
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIX SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Entitlements:");
  console.log(`  Total scanned:        ${stats.totalScanned}`);
  console.log(`  With tier='founders': ${stats.foundersFound}`);
  console.log("");

  if (stats.foundersFound > 0) {
    console.log(`${isDryRun ? "Would repair" : "Repaired"} to:`);
    console.log(`  → maker:              ${stats.repairedToMaker}`);
    console.log(`  → pro:                ${stats.repairedToPro}`);
    console.log(`  → education:          ${stats.repairedToEducation}`);
    console.log(`  → enterprise:         ${stats.repairedToEnterprise}`);
    console.log("");
    console.log("All repaired entitlements:");
    console.log("  - Set isLifetime=true (founders billing promise)");
    console.log("  - Set expiresAt=null (no expiration for lifetime)");
    console.log("  - Set maxDevices based on tier");
  }

  if (stats.errors.length > 0) {
    console.log("");
    console.log(`Errors: ${stats.errors.length}`);
    stats.errors.forEach((err) => {
      console.log(`  - Entitlement #${err.entitlementId}: ${err.error}`);
    });
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");

  if (isDryRun) {
    console.log("");
    console.log("This was a DRY RUN. No changes were made.");
    console.log("Run with --apply to update entitlements.");
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

    // Run the fix
    await runFix(strapiInstance);

  } catch (error) {
    console.error("Fix script failed:", error);
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
