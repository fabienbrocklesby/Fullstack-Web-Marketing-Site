#!/usr/bin/env node
/**
 * Dedupe Entitlements Script
 *
 * Finds and archives duplicate entitlements for a customer.
 * Also fixes maxDevices to 1 for maker/pro tiers in the kept record.
 *
 * Usage:
 *   node scripts/dedupe-entitlements.js --email=user@example.com
 *   node scripts/dedupe-entitlements.js --customer-id=123
 *   node scripts/dedupe-entitlements.js --email=user@example.com --apply
 *
 * Options:
 *   --email=<email>        Customer email to dedupe
 *   --customer-id=<id>     Customer Strapi ID to dedupe
 *   --apply                Apply changes (default: dry run)
 *   --fix-all-devices      Fix maxDevices for all active entitlements, not just kept
 *   --help                 Show this help message
 *
 * What it does:
 * 1. Finds all entitlements for the customer
 * 2. Groups by tier (maker, pro, etc.)
 * 3. For each tier with duplicates:
 *    - Keeps the "best" entitlement (lifetime > active > newest)
 *    - Archives duplicates by setting isArchived=true
 *    - Fixes maxDevices to 1 for maker/pro in the kept record
 */

const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  email: null,
  customerId: null,
  apply: false,
  fixAllDevices: false,
  help: false,
};

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    options.help = true;
  } else if (arg === "--apply") {
    options.apply = true;
  } else if (arg === "--fix-all-devices") {
    options.fixAllDevices = true;
  } else if (arg.startsWith("--email=")) {
    options.email = arg.split("=")[1];
  } else if (arg.startsWith("--customer-id=")) {
    options.customerId = parseInt(arg.split("=")[1], 10);
  }
}

if (options.help) {
  console.log(`
Dedupe Entitlements Script

Finds and archives duplicate entitlements for a customer.
Also fixes maxDevices to 1 for maker/pro tiers.

Usage:
  node scripts/dedupe-entitlements.js --email=user@example.com
  node scripts/dedupe-entitlements.js --customer-id=123
  node scripts/dedupe-entitlements.js --email=user@example.com --apply

Options:
  --email=<email>        Customer email to dedupe
  --customer-id=<id>     Customer Strapi ID to dedupe
  --apply                Apply changes (default: dry run)
  --fix-all-devices      Fix maxDevices for all active maker/pro entitlements
  --help                 Show this help message
`);
  process.exit(0);
}

if (!options.email && !options.customerId) {
  console.error("Error: Either --email or --customer-id is required");
  console.error("Run with --help for usage information");
  process.exit(1);
}

/**
 * Score an entitlement for "best" selection.
 * Higher score = better (should be kept).
 */
function scoreEntitlement(ent) {
  let score = 0;

  // Lifetime is most valuable (can't be recreated)
  if (ent.isLifetime === true) score += 1000;

  // Active status
  if (ent.status === "active") score += 100;
  else if (ent.status === "inactive") score += 10;
  else if (ent.status === "expired") score += 5;
  else if (ent.status === "canceled") score += 1;

  // Has license key attached
  if (ent.licenseKey) score += 50;

  // Has Stripe subscription (ongoing billing relationship)
  if (ent.stripeSubscriptionId) score += 30;

  // Newer is slightly better (for tie-breaking)
  const createdAt = new Date(ent.createdAt).getTime();
  score += createdAt / 1e15; // Very small bonus for recency

  return score;
}

/**
 * Determine which entitlements to keep and which to archive.
 */
function planDedupe(entitlements) {
  // Group by tier
  const byTier = {};
  for (const ent of entitlements) {
    const tier = ent.tier || "unknown";
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push(ent);
  }

  const toKeep = [];
  const toArchive = [];
  const toFixDevices = [];

  for (const [tier, ents] of Object.entries(byTier)) {
    if (ents.length === 1) {
      // No duplicates for this tier
      const ent = ents[0];
      toKeep.push({ ...ent, reason: "only entitlement for tier" });

      // Check if maxDevices needs fixing
      if ((tier === "maker" || tier === "pro") && ent.maxDevices !== 1) {
        toFixDevices.push(ent);
      }
    } else {
      // Multiple entitlements for this tier - dedupe
      const scored = ents.map((e) => ({ ent: e, score: scoreEntitlement(e) }));
      scored.sort((a, b) => b.score - a.score);

      const best = scored[0].ent;
      toKeep.push({ ...best, reason: `best of ${ents.length} (score: ${scored[0].score.toFixed(2)})` });

      // Check if maxDevices needs fixing for the kept one
      if ((tier === "maker" || tier === "pro") && best.maxDevices !== 1) {
        toFixDevices.push(best);
      }

      // Archive the rest
      for (let i = 1; i < scored.length; i++) {
        toArchive.push({
          ...scored[i].ent,
          reason: `duplicate (score: ${scored[i].score.toFixed(2)}, lower than kept)`,
        });
      }
    }
  }

  return { toKeep, toArchive, toFixDevices };
}

async function main() {
  // Bootstrap Strapi
  const strapiPath = path.resolve(__dirname, "..");
  process.chdir(strapiPath);

  console.log("Bootstrapping Strapi...");
  const strapi = require("@strapi/strapi");
  const app = await strapi().load();

  try {
    // Find customer
    let customer;
    if (options.customerId) {
      customer = await app.entityService.findOne(
        "api::customer.customer",
        options.customerId
      );
    } else {
      const customers = await app.entityService.findMany(
        "api::customer.customer",
        {
          filters: { email: options.email },
          limit: 1,
        }
      );
      customer = customers[0];
    }

    if (!customer) {
      console.error(`Customer not found: ${options.email || options.customerId}`);
      process.exit(1);
    }

    console.log(`\nCustomer: ${customer.email} (ID: ${customer.id})`);
    console.log("=".repeat(60));

    // Fetch all entitlements (including archived for visibility)
    const entitlements = await app.entityService.findMany(
      "api::entitlement.entitlement",
      {
        filters: { customer: customer.id },
        populate: ["licenseKey"],
        sort: { createdAt: "desc" },
      }
    );

    console.log(`\nTotal entitlements: ${entitlements.length}`);

    // Filter to non-archived only for dedupe planning
    const activeEntitlements = entitlements.filter((e) => !e.isArchived);
    const alreadyArchived = entitlements.filter((e) => e.isArchived);

    console.log(`Non-archived: ${activeEntitlements.length}`);
    console.log(`Already archived: ${alreadyArchived.length}`);

    if (activeEntitlements.length === 0) {
      console.log("\nNo active entitlements to dedupe.");
      process.exit(0);
    }

    // Plan dedupe
    const { toKeep, toArchive, toFixDevices } = planDedupe(activeEntitlements);

    // Print plan
    console.log("\n" + "=".repeat(60));
    console.log("ENTITLEMENTS TO KEEP:");
    console.log("=".repeat(60));
    for (const ent of toKeep) {
      console.log(`  [KEEP] ID=${ent.id} tier=${ent.tier} status=${ent.status} ` +
        `isLifetime=${ent.isLifetime} maxDevices=${ent.maxDevices}`);
      console.log(`         Reason: ${ent.reason}`);
      if (ent.licenseKey) {
        console.log(`         License: ${ent.licenseKey.key?.substring(0, 20)}...`);
      }
    }

    if (toArchive.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("ENTITLEMENTS TO ARCHIVE:");
      console.log("=".repeat(60));
      for (const ent of toArchive) {
        console.log(`  [ARCHIVE] ID=${ent.id} tier=${ent.tier} status=${ent.status} ` +
          `isLifetime=${ent.isLifetime} maxDevices=${ent.maxDevices}`);
        console.log(`            Reason: ${ent.reason}`);
        if (ent.licenseKey) {
          console.log(`            License: ${ent.licenseKey.key?.substring(0, 20)}...`);
        }
      }
    } else {
      console.log("\n✓ No duplicates to archive.");
    }

    if (toFixDevices.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("ENTITLEMENTS TO FIX maxDevices (→ 1):");
      console.log("=".repeat(60));
      for (const ent of toFixDevices) {
        console.log(`  [FIX] ID=${ent.id} tier=${ent.tier} maxDevices=${ent.maxDevices} → 1`);
      }
    } else {
      console.log("\n✓ No maxDevices fixes needed for kept entitlements.");
    }

    // Optionally fix all active maker/pro entitlements
    let allToFixDevices = [];
    if (options.fixAllDevices) {
      allToFixDevices = activeEntitlements.filter(
        (e) => (e.tier === "maker" || e.tier === "pro") && e.maxDevices !== 1
      );
      if (allToFixDevices.length > toFixDevices.length) {
        console.log("\n" + "=".repeat(60));
        console.log("ALL ENTITLEMENTS TO FIX maxDevices (--fix-all-devices):");
        console.log("=".repeat(60));
        for (const ent of allToFixDevices) {
          console.log(`  [FIX] ID=${ent.id} tier=${ent.tier} maxDevices=${ent.maxDevices} → 1`);
        }
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY:");
    console.log("=".repeat(60));
    console.log(`  Keep: ${toKeep.length}`);
    console.log(`  Archive: ${toArchive.length}`);
    console.log(`  Fix maxDevices: ${options.fixAllDevices ? allToFixDevices.length : toFixDevices.length}`);

    if (!options.apply) {
      console.log("\n⚠️  DRY RUN - No changes made.");
      console.log("   Run with --apply to execute these changes.");
      process.exit(0);
    }

    // Apply changes
    console.log("\n🔧 Applying changes...");

    // Archive duplicates
    for (const ent of toArchive) {
      await app.entityService.update("api::entitlement.entitlement", ent.id, {
        data: { isArchived: true },
      });
      console.log(`  ✓ Archived entitlement ID=${ent.id}`);
    }

    // Fix maxDevices
    const devicesToFix = options.fixAllDevices ? allToFixDevices : toFixDevices;
    for (const ent of devicesToFix) {
      await app.entityService.update("api::entitlement.entitlement", ent.id, {
        data: { maxDevices: 1 },
      });
      console.log(`  ✓ Fixed maxDevices for entitlement ID=${ent.id}`);
    }

    console.log("\n✅ Done! Changes applied successfully.");
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
