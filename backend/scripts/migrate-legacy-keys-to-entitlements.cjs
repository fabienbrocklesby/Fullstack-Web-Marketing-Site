#!/usr/bin/env node
/**
 * Stage 5.5 Migration Script: Migrate Legacy License Keys to Entitlements
 * 
 * NOTE: This script uses .cjs extension to run as CommonJS because Strapi 4.x
 * has internal ESM compatibility issues with Node.js v22+.
 * 
 * RUN VIA DOCKER (recommended):
 *   docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --dry-run
 *   docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply
 * 
 * This script migrates existing legacy license keys (MAC-based) to the unified
 * entitlement system. After migration, all activation uses Stage 4/5 device-based
 * endpoints.
 * 
 * Usage:
 *   docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --dry-run
 *   docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply
 *   docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply --email user@example.com
 * 
 * Features:
 *   - Idempotent: running twice will not create duplicates
 *   - Marks migrated records with migratedAt timestamp
 *   - Does NOT delete original license-key records (preserves history)
 *   - Supports filtering by email for targeted migration
 * 
 * Exit Codes:
 *   0 - Success
 *   1 - Error or invalid arguments
 */

const path = require("path");
const fs = require("fs");

// Resolve backend directory path (we're now inside backend/scripts/)
const backendDir = path.resolve(__dirname, "..");

// Load environment from backend/.env using fs (no dotenv dependency needed)
function loadEnvFile(envPath) {
  try {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // Ignore if .env doesn't exist
  }
}

loadEnvFile(path.join(backendDir, ".env"));

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isApply = args.includes("--apply");
const emailIndex = args.indexOf("--email");
const targetEmail = emailIndex !== -1 ? args[emailIndex + 1] : null;

if (!isDryRun && !isApply) {
  console.log(`
Stage 5.5 Migration: Legacy License Keys → Entitlements

Usage (run via Docker):
  docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --dry-run
  docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply
  docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply --email user@example.com

Options:
  --dry-run    Show what would be migrated without making changes
  --apply      Actually perform the migration
  --email      Only migrate keys for a specific customer email
`);
  process.exit(1);
}

// Tier configuration (must match backend/src/utils/entitlement-mapping.js)
const TIER_CONFIG = {
  maker: { maxDevices: 1 },
  pro: { maxDevices: 1 },
  education: { maxDevices: 5 },
  enterprise: { maxDevices: 10 },
};

// Map license type to tier
function mapLicenseTypeToTier(typ) {
  const mapping = {
    trial: "maker",
    starter: "maker",
    paid: "maker",
    pro: "pro",
    enterprise: "enterprise",
  };
  return mapping[typ] || "maker";
}

// Determine if license should be lifetime (founders)
function isFoundersLifetime(licenseKey, createdAt) {
  // Founders sale ended 2026-01-11T23:59:59Z
  const foundersCutoff = new Date("2026-01-11T23:59:59Z");
  const created = new Date(createdAt);
  
  // If created during founders window AND it's a one-time purchase (not subscription)
  // We determine this by checking if there's no subscription ID
  const isDuringFounders = created <= foundersCutoff;
  
  // Check if it's a one-time purchase by looking for subscription markers
  const isOneTime = !licenseKey.stripeSubscriptionId;
  
  return isDuringFounders && isOneTime;
}

async function runMigration() {
  console.log("=".repeat(70));
  console.log("Stage 5.5 Migration: Legacy License Keys → Entitlements");
  console.log("=".repeat(70));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "APPLY (will modify database)"}`);
  if (targetEmail) {
    console.log(`Target: Only customer with email: ${targetEmail}`);
  }
  console.log("");

  // Ensure we're in backend directory (Strapi must be loaded from there)
  process.chdir(backendDir);
  console.log(`Working directory: ${process.cwd()}`);

  // Initialize Strapi (same pattern as other scripts like backfill-entitlements.js)
  console.log("Initializing Strapi...");
  const strapi = require("@strapi/strapi");
  const app = await strapi().load();
  
  console.log("Strapi loaded successfully.\n");

  const stats = {
    totalLicenseKeys: 0,
    alreadyHaveEntitlement: 0,
    alreadyMigrated: 0,
    needsMigration: 0,
    migrated: 0,
    errors: 0,
  };

  try {
    // Build customer filter
    let customerFilter = {};
    if (targetEmail) {
      const customer = await app.entityService.findMany(
        "api::customer.customer",
        { filters: { email: targetEmail }, limit: 1 }
      );
      if (!customer || customer.length === 0) {
        console.error(`❌ Customer not found with email: ${targetEmail}`);
        process.exit(1);
      }
      customerFilter = { customer: customer[0].id };
      console.log(`Found customer: ${customer[0].email} (ID: ${customer[0].id})`);
    }

    // Fetch all license keys with their entitlements and customers
    console.log("\nFetching license keys...");
    const licenseKeys = await app.entityService.findMany(
      "api::license-key.license-key",
      {
        filters: customerFilter,
        populate: ["customer", "entitlement", "purchase"],
      }
    );

    stats.totalLicenseKeys = licenseKeys.length;
    console.log(`Found ${stats.totalLicenseKeys} license key(s)\n`);

    if (stats.totalLicenseKeys === 0) {
      console.log("No license keys to migrate.");
      await app.destroy();
      return;
    }

    console.log("-".repeat(70));
    console.log("Processing license keys...\n");

    for (const lk of licenseKeys) {
      const logPrefix = `[LK#${lk.id}]`;
      
      // Check if already migrated (has migratedAt timestamp in metadata)
      if (lk.metadata?.migratedAt) {
        console.log(`${logPrefix} Already migrated on ${lk.metadata.migratedAt} - SKIP`);
        stats.alreadyMigrated++;
        continue;
      }

      // Check if already has an entitlement
      if (lk.entitlement) {
        console.log(`${logPrefix} Already has entitlement #${lk.entitlement.id} - SKIP`);
        stats.alreadyHaveEntitlement++;
        continue;
      }

      // No customer = cannot create entitlement
      if (!lk.customer) {
        console.log(`${logPrefix} No customer linked - ERROR`);
        stats.errors++;
        continue;
      }

      stats.needsMigration++;

      // Determine tier and lifetime status
      const tier = mapLicenseTypeToTier(lk.typ);
      const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.maker;
      const isLifetime = isFoundersLifetime(lk, lk.createdAt);

      console.log(`${logPrefix} Needs migration:`);
      console.log(`   Customer: ${lk.customer.email || lk.customer.id}`);
      console.log(`   Key: ${lk.key?.substring(0, 20)}...`);
      console.log(`   Type: ${lk.typ} → Tier: ${tier}`);
      console.log(`   Lifetime: ${isLifetime ? "YES (founders)" : "NO (subscription)"}`);
      console.log(`   Max Devices: ${tierConfig.maxDevices}`);

      if (isDryRun) {
        console.log(`   Action: WOULD CREATE entitlement (dry-run)\n`);
        continue;
      }

      // Create the entitlement
      try {
        const newEntitlement = await app.entityService.create(
          "api::entitlement.entitlement",
          {
            data: {
              customer: lk.customer.id,
              licenseKey: lk.id,
              purchase: lk.purchase?.id || null,
              tier: tier,
              status: lk.isActive ? "active" : "inactive",
              isLifetime: isLifetime,
              expiresAt: isLifetime ? null : lk.expiresAt,
              maxDevices: tierConfig.maxDevices,
              source: "legacy_migration",
              metadata: {
                migratedFrom: "license-key",
                migratedAt: new Date().toISOString(),
                originalLicenseType: lk.typ,
                originalLicenseKey: lk.key,
              },
            },
          }
        );

        // Mark the license key as migrated
        await app.entityService.update(
          "api::license-key.license-key",
          lk.id,
          {
            data: {
              metadata: {
                ...(lk.metadata || {}),
                migratedAt: new Date().toISOString(),
                migratedToEntitlement: newEntitlement.id,
              },
            },
          }
        );

        console.log(`   Action: CREATED entitlement #${newEntitlement.id}\n`);
        stats.migrated++;

      } catch (err) {
        console.log(`   Action: FAILED - ${err.message}\n`);
        stats.errors++;
      }
    }

    // Print summary
    console.log("-".repeat(70));
    console.log("\nMigration Summary:");
    console.log(`  Total license keys:      ${stats.totalLicenseKeys}`);
    console.log(`  Already have entitlement: ${stats.alreadyHaveEntitlement}`);
    console.log(`  Already migrated:        ${stats.alreadyMigrated}`);
    console.log(`  Needed migration:        ${stats.needsMigration}`);
    if (isDryRun) {
      console.log(`  Would migrate:           ${stats.needsMigration}`);
    } else {
      console.log(`  Successfully migrated:   ${stats.migrated}`);
    }
    console.log(`  Errors:                  ${stats.errors}`);
    console.log("");

    if (isDryRun && stats.needsMigration > 0) {
      console.log("To apply this migration, run:");
      console.log("  docker exec lightlane-backend-dev node scripts/migrate-legacy-keys-to-entitlements.cjs --apply");
    }

  } catch (error) {
    console.error("Migration failed:", error);
    stats.errors++;
  } finally {
    await app.destroy();
  }

  console.log("\n" + "=".repeat(70));
  console.log("Migration complete.");
  process.exit(stats.errors > 0 ? 1 : 0);
}

runMigration();
