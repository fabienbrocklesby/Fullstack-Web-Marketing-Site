#!/usr/bin/env node
/**
 * dev-purge-customers.js
 *
 * Development-only script to purge PORTAL CUSTOMERS (api::customer.customer)
 * and ALL their related records (entitlements, devices, purchases, etc.).
 *
 * This script ONLY targets portal customers. It will NEVER touch:
 *   - admin::user (Strapi admin users)
 *   - plugin::users-permissions.user (Strapi users-permissions users)
 *
 * SAFETY:
 *   - Refuses to run unless NODE_ENV === "development"
 *   - Refuses to run unless ALLOW_DEV_PURGE === "1"
 *   - Requires interactive confirmation (type "DELETE")
 *   - Shows dry-run summary before any deletions
 *   - Hard-coded to ONLY use api::customer.customer UID
 *
 * USAGE:
 *   # From repo root:
 *   make dev-purge-customers
 *
 *   # Or directly:
 *   NODE_ENV=development ALLOW_DEV_PURGE=1 node scripts/dev-purge-customers.js
 */

const readline = require("readline");

// ====================
// HARD-CODED SAFE UIDs (portal customers only, NEVER admin/users-permissions)
// ====================

const CUSTOMER_UID = "api::customer.customer";

// These UIDs are FORBIDDEN - script will abort if it ever tries to touch them
const FORBIDDEN_UIDS = [
  "admin::user",
  "plugin::users-permissions.user",
  "plugin::users-permissions.role",
  "plugin::users-permissions.permission",
];

// Related content types that have a relation to customer
const CONTENT_TYPES = {
  customer: CUSTOMER_UID,
  entitlement: "api::entitlement.entitlement",
  device: "api::device.device",
  purchase: "api::purchase.purchase",
  licenseKey: "api::license-key.license-key",
  offlineChallenge: "api::offline-challenge.offline-challenge",
  offlineCodeUse: "api::offline-code-use.offline-code-use",
};

// ====================
// SAFETY GATES
// ====================

function checkSafetyGates() {
  const errors = [];

  if (process.env.NODE_ENV !== "development") {
    errors.push(
      `NODE_ENV must be "development" (current: "${process.env.NODE_ENV || "undefined"}")`
    );
  }

  if (process.env.ALLOW_DEV_PURGE !== "1") {
    errors.push(
      `ALLOW_DEV_PURGE must be "1" (current: "${process.env.ALLOW_DEV_PURGE || "undefined"}")`
    );
  }

  if (errors.length > 0) {
    console.error("\n❌ SAFETY CHECK FAILED - This script cannot run.\n");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\nThis script is DEVELOPMENT-ONLY and requires explicit opt-in.\n");
    console.error("To run:");
    console.error("  make dev-purge-customers\n");
    process.exit(1);
  }

  console.log("✅ Safety gates passed (NODE_ENV=development, ALLOW_DEV_PURGE=1)\n");
}

function assertSafeUID(uid) {
  if (FORBIDDEN_UIDS.some((forbidden) => uid.startsWith(forbidden.split("::")[0] + "::"))) {
    console.error(`\n🚨 CRITICAL SAFETY ABORT 🚨`);
    console.error(`   Attempted to access forbidden UID: ${uid}`);
    console.error(`   This script ONLY operates on portal customers (${CUSTOMER_UID}).`);
    console.error(`   It will NEVER touch admin::* or plugin::users-permissions.* records.\n`);
    process.exit(1);
  }
}

// ====================
// READLINE HELPERS
// ====================

function createReadlineInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Track if readline has been closed (e.g., stdin EOF)
  rl._isClosed = false;
  rl.on("close", () => {
    rl._isClosed = true;
  });

  return rl;
}

function prompt(rl, question) {
  return new Promise((resolve, reject) => {
    // If readline is already closed (stdin EOF), resolve with empty string
    if (rl._isClosed) {
      resolve("");
      return;
    }

    rl.question(question, (answer) => {
      resolve(answer.trim());
    });

    // Handle case where stdin closes while waiting for input
    rl.once("close", () => {
      resolve("");
    });
  });
}

// ====================
// DATA ACCESS FUNCTIONS
// ====================

async function getAllCustomers(strapi, limit = 500) {
  // Safety check: ensure we're querying the correct UID
  assertSafeUID(CUSTOMER_UID);

  return await strapi.entityService.findMany(CUSTOMER_UID, {
    limit,
    sort: { createdAt: "desc" },
  });
}

async function getRelatedRecordCounts(strapi, customerId) {
  // Records with relation field "customer" pointing to customer
  const [entitlements, devices, purchases, licenseKeys] = await Promise.all([
    strapi.entityService.findMany(CONTENT_TYPES.entitlement, {
      filters: { customer: customerId },
    }),
    strapi.entityService.findMany(CONTENT_TYPES.device, {
      filters: { customer: customerId },
    }),
    strapi.entityService.findMany(CONTENT_TYPES.purchase, {
      filters: { customer: customerId },
    }),
    strapi.entityService.findMany(CONTENT_TYPES.licenseKey, {
      filters: { customer: customerId },
    }),
  ]);

  // Records with integer customerId field (not a relation)
  const [offlineChallenges, offlineCodeUses] = await Promise.all([
    strapi.entityService.findMany(CONTENT_TYPES.offlineChallenge, {
      filters: { customerId: customerId },
    }),
    strapi.entityService.findMany(CONTENT_TYPES.offlineCodeUse, {
      filters: { customerId: customerId },
    }),
  ]);

  return {
    entitlements: entitlements.length,
    devices: devices.length,
    purchases: purchases.length,
    licenseKeys: licenseKeys.length,
    offlineChallenges: offlineChallenges.length,
    offlineCodeUses: offlineCodeUses.length,
    total:
      entitlements.length +
      devices.length +
      purchases.length +
      licenseKeys.length +
      offlineChallenges.length +
      offlineCodeUses.length,
  };
}

async function deleteCustomerAndRelated(strapi, customerId) {
  // Final safety check before any deletion
  assertSafeUID(CUSTOMER_UID);

  const deleted = {
    offlineChallenges: 0,
    offlineCodeUses: 0,
    devices: 0,
    entitlements: 0,
    licenseKeys: 0,
    purchases: 0,
    customer: 0,
  };

  // 1. Delete offline challenges (integer customerId field)
  const offlineChallenges = await strapi.entityService.findMany(
    CONTENT_TYPES.offlineChallenge,
    { filters: { customerId: customerId } }
  );
  for (const record of offlineChallenges) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.offlineChallenge, record.id);
      deleted.offlineChallenges++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete offline-challenge ${record.id}: ${err.message}`);
    }
  }

  // 2. Delete offline code uses (integer customerId field)
  const offlineCodeUses = await strapi.entityService.findMany(
    CONTENT_TYPES.offlineCodeUse,
    { filters: { customerId: customerId } }
  );
  for (const record of offlineCodeUses) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.offlineCodeUse, record.id);
      deleted.offlineCodeUses++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete offline-code-use ${record.id}: ${err.message}`);
    }
  }

  // 3. Delete devices (FK relation to customer)
  const devices = await strapi.entityService.findMany(CONTENT_TYPES.device, {
    filters: { customer: customerId },
  });
  for (const record of devices) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.device, record.id);
      deleted.devices++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete device ${record.id}: ${err.message}`);
    }
  }

  // 4. Delete entitlements (FK relation to customer)
  const entitlements = await strapi.entityService.findMany(
    CONTENT_TYPES.entitlement,
    { filters: { customer: customerId } }
  );
  for (const record of entitlements) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.entitlement, record.id);
      deleted.entitlements++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete entitlement ${record.id}: ${err.message}`);
    }
  }

  // 5. Delete license keys (FK relation to customer)
  const licenseKeys = await strapi.entityService.findMany(
    CONTENT_TYPES.licenseKey,
    { filters: { customer: customerId } }
  );
  for (const record of licenseKeys) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.licenseKey, record.id);
      deleted.licenseKeys++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete license-key ${record.id}: ${err.message}`);
    }
  }

  // 6. Delete purchases (FK relation to customer)
  const purchases = await strapi.entityService.findMany(CONTENT_TYPES.purchase, {
    filters: { customer: customerId },
  });
  for (const record of purchases) {
    try {
      await strapi.entityService.delete(CONTENT_TYPES.purchase, record.id);
      deleted.purchases++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to delete purchase ${record.id}: ${err.message}`);
    }
  }

  // 7. Finally delete the customer (using the safe UID)
  try {
    await strapi.entityService.delete(CUSTOMER_UID, customerId);
    deleted.customer = 1;
  } catch (err) {
    console.warn(`  ⚠️  Failed to delete customer ${customerId}: ${err.message}`);
  }

  return deleted;
}

// ====================
// DISPLAY HELPERS
// ====================

function displayCustomerList(customers) {
  console.log("");
  console.log("Portal Customers (api::customer.customer):");
  console.log("═".repeat(80));

  customers.forEach((c, i) => {
    const idx = String(i + 1).padStart(3);
    const email = c.email || "(no email)";
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "";
    const created = c.createdAt ? c.createdAt.substring(0, 10) : "N/A";
    const nameDisplay = name ? ` - ${name}` : "";
    console.log(`  ${idx}) ${email}${nameDisplay} (created ${created}) [id: ${c.id}]`);
  });

  console.log("═".repeat(80));
  console.log(`  Total: ${customers.length} customer(s)\n`);
}

function displayDryRunSummary(customer, counts) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "(no name)";
  console.log(`\n  📧 ${customer.email} - ${name} [id: ${customer.id}]`);
  console.log(`     Created: ${customer.createdAt}`);
  console.log(`     Related records:`);
  console.log(`       Entitlements:       ${counts.entitlements}`);
  console.log(`       Devices:            ${counts.devices}`);
  console.log(`       Purchases:          ${counts.purchases}`);
  console.log(`       License Keys:       ${counts.licenseKeys}`);
  console.log(`       Offline Challenges: ${counts.offlineChallenges}`);
  console.log(`       Offline Code Uses:  ${counts.offlineCodeUses}`);
  console.log(`     ─────────────────────────`);
  console.log(`     Total related: ${counts.total}`);
}

function displayDeletionReport(customer, deleted) {
  console.log(`\n  ✅ Deleted: ${customer.email} [id: ${customer.id}]`);
  console.log(`     Offline Challenges: ${deleted.offlineChallenges}`);
  console.log(`     Offline Code Uses:  ${deleted.offlineCodeUses}`);
  console.log(`     Devices:            ${deleted.devices}`);
  console.log(`     Entitlements:       ${deleted.entitlements}`);
  console.log(`     License Keys:       ${deleted.licenseKeys}`);
  console.log(`     Purchases:          ${deleted.purchases}`);
  console.log(`     Customer:           ${deleted.customer}`);
}

// ====================
// MAIN SCRIPT
// ====================

async function main() {
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("   DEV PURGE CUSTOMERS - Portal Customer Cleanup Tool");
  console.log("════════════════════════════════════════════════════════════════");
  console.log("   Target: api::customer.customer (portal users ONLY)");
  console.log("   This script NEVER touches admin::* or plugin::users-permissions.*");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Safety check first
  checkSafetyGates();

  const startTime = Date.now();

  // Initialize Strapi
  console.log("🔧 Initializing Strapi...");
  const strapi = require("@strapi/strapi");
  const app = await strapi().load();
  console.log("✅ Strapi initialized\n");

  const rl = createReadlineInterface();

  try {
    // Step 1: Fetch all customers
    console.log("📋 Fetching all portal customers...\n");
    const customers = await getAllCustomers(app);

    if (customers.length === 0) {
      console.log("ℹ️  No portal customers found in the database.\n");
      return;
    }

    displayCustomerList(customers);

    // Step 2: Show usage instructions
    console.log("Commands:");
    console.log("  • Enter numbers like 1,3,7 to select specific customers");
    console.log("  • Enter 'all' to select ALL customers");
    console.log("  • Enter 'dry' to see counts only (no deletion)");
    console.log("  • Enter 'q' to quit\n");

    const selection = await prompt(rl, "🔢 Selection: ");

    if (selection.toLowerCase() === "q" || !selection) {
      console.log("\n👋 Exiting without changes.\n");
      return;
    }

    // Parse selection
    let selectedCustomers = [];

    if (selection.toLowerCase() === "all") {
      selectedCustomers = customers;
      console.log(`\n📌 Selected ALL ${customers.length} customer(s)`);
    } else if (selection.toLowerCase() === "dry") {
      // Dry run mode - show counts for all customers
      console.log("\n════════════════════════════════════════════════════════════════");
      console.log("                    📋 DRY RUN - ALL CUSTOMERS");
      console.log("════════════════════════════════════════════════════════════════");

      let totalRelated = 0;
      for (const customer of customers) {
        const counts = await getRelatedRecordCounts(app, customer.id);
        displayDryRunSummary(customer, counts);
        totalRelated += counts.total;
      }

      console.log("\n════════════════════════════════════════════════════════════════");
      console.log(`   TOTAL: ${customers.length} customer(s) + ${totalRelated} related records`);
      console.log("════════════════════════════════════════════════════════════════");
      console.log("\n👋 Dry run complete. No records were deleted.\n");
      return;
    } else {
      // Parse comma-separated indexes
      const indexes = selection
        .split(",")
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((i) => !isNaN(i) && i >= 0 && i < customers.length);

      if (indexes.length === 0) {
        console.log("\n❌ No valid indexes selected. Valid range: 1-" + customers.length);
        console.log("   Example: 1,3,5 or just: 1\n");
        return;
      }

      // Check for invalid indexes in the original input
      const inputNumbers = selection.split(",").map((s) => parseInt(s.trim(), 10));
      const invalidNumbers = inputNumbers.filter((n) => isNaN(n) || n < 1 || n > customers.length);
      if (invalidNumbers.length > 0) {
        console.log(`\n⚠️  Ignored invalid indexes: ${invalidNumbers.join(", ")}`);
      }

      selectedCustomers = indexes.map((i) => customers[i]);
      console.log(`\n📌 Selected ${selectedCustomers.length} customer(s)`);
    }

    // Step 3: Dry run - show what will be deleted
    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("                    📋 DRY RUN SUMMARY");
    console.log("════════════════════════════════════════════════════════════════");

    const dryRunResults = [];
    for (const customer of selectedCustomers) {
      const counts = await getRelatedRecordCounts(app, customer.id);
      displayDryRunSummary(customer, counts);
      dryRunResults.push({ customer, counts });
    }

    const totalRelated = dryRunResults.reduce((sum, r) => sum + r.counts.total, 0);
    const totalRecords = totalRelated + selectedCustomers.length;

    console.log("\n════════════════════════════════════════════════════════════════");
    console.log(`   TOTAL: ${selectedCustomers.length} customer(s) + ${totalRelated} related = ${totalRecords} records`);
    console.log("════════════════════════════════════════════════════════════════");

    // Step 4: Final confirmation
    console.log("\n⚠️  WARNING: This action is IRREVERSIBLE!");
    console.log("   All listed customers and their data will be permanently deleted.\n");

    const confirmation = await prompt(rl, '🔐 Type "DELETE" to confirm, or anything else to cancel: ');

    if (confirmation !== "DELETE") {
      console.log("\n👋 Confirmation not received. Exiting without changes.\n");
      return;
    }

    // Step 5: Execute deletions
    console.log("\n🗑️  Deleting records...");

    const deletionResults = [];
    let totalDeleted = 0;

    for (const { customer } of dryRunResults) {
      const deleted = await deleteCustomerAndRelated(app, customer.id);
      displayDeletionReport(customer, deleted);
      deletionResults.push({ customer, deleted });

      totalDeleted +=
        deleted.offlineChallenges +
        deleted.offlineCodeUses +
        deleted.devices +
        deleted.entitlements +
        deleted.licenseKeys +
        deleted.purchases +
        deleted.customer;
    }

    // Final report
    const elapsedMs = Date.now() - startTime;
    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("                    ✅ PURGE COMPLETE");
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`   Customers deleted:  ${deletionResults.length}`);
    console.log(`   Total records:      ${totalDeleted}`);
    console.log(`   Time elapsed:       ${(elapsedMs / 1000).toFixed(2)}s`);
    console.log("════════════════════════════════════════════════════════════════\n");
  } finally {
    rl.close();
    await app.destroy();
  }
}

// Run
main().catch((err) => {
  console.error("\n❌ Script failed with error:", err);
  process.exit(1);
});
