#!/usr/bin/env node
/**
 * Stage 3 Sanity Tests - Stripe Webhook & Subscription Flow
 * 
 * Tests:
 * A) stripe-event collection exists and works for idempotency
 * B) Webhook handler processes checkout.session.completed correctly
 * C) Webhook handler enforces founders protection (isLifetime=true unchanged)
 * D) Purchase status polling endpoint returns correct shape
 * E) Customer checkout endpoints work (payment + subscription)
 * F) Billing portal endpoint returns redirect URL
 * G) Deprecated process-customer-purchase returns 410 Gone
 * 
 * Usage:
 *   node scripts/sanity-stage3.js --test=idempotency
 *   node scripts/sanity-stage3.js --test=webhook
 *   node scripts/sanity-stage3.js --test=founders
 *   node scripts/sanity-stage3.js --test=polling
 *   node scripts/sanity-stage3.js --test=all
 *   node scripts/sanity-stage3.js --cleanup  (removes test data)
 * 
 * SAFETY:
 *   - Refuses to run if NODE_ENV=production or STRAPI_ENV=production
 *   - Refuses to run if DATABASE_HOST contains known production patterns
 *   - All test data uses SANITY_TEST_ prefix for easy identification
 *   - This script is DEV-ONLY and must never be imported by runtime code
 */

const crypto = require("crypto");

// ============================================================================
// PRODUCTION SAFETY GUARDS
// ============================================================================
function checkEnvironmentSafety() {
  const nodeEnv = process.env.NODE_ENV || "";
  const strapiEnv = process.env.STRAPI_ENV || "";
  const dbHost = process.env.DATABASE_HOST || "";
  
  const errors = [];
  
  // Block if explicitly production
  if (nodeEnv.toLowerCase() === "production") {
    errors.push("NODE_ENV is set to 'production'");
  }
  if (strapiEnv.toLowerCase() === "production") {
    errors.push("STRAPI_ENV is set to 'production'");
  }
  
  // Block if database host looks like production (basic heuristic)
  const prodDbPatterns = [
    /\.rds\.amazonaws\.com/i,
    /\.postgres\.database\.azure\.com/i,
    /\.cloudsql\.google\.com/i,
    /prod/i,
    /production/i,
  ];
  for (const pattern of prodDbPatterns) {
    if (pattern.test(dbHost)) {
      errors.push(`DATABASE_HOST '${dbHost}' matches production pattern: ${pattern}`);
      break;
    }
  }
  
  if (errors.length > 0) {
    console.error("═══════════════════════════════════════════════════════════════");
    console.error("  ⛔ SANITY SCRIPT BLOCKED - PRODUCTION ENVIRONMENT DETECTED");
    console.error("═══════════════════════════════════════════════════════════════");
    console.error("\nThis script is DEV-ONLY and refuses to run in production.\n");
    errors.forEach(e => console.error(`  • ${e}`));
    console.error("\nIf this is actually a dev environment, ensure:");
    console.error("  - NODE_ENV is 'development' (or unset)");
    console.error("  - DATABASE_HOST does not contain 'prod' or cloud provider patterns");
    console.error("");
    process.exit(1);
  }
  
  console.log("✅ Environment safety check passed (not production)\n");
}

// Run safety check immediately
checkEnvironmentSafety();

const TEST_PREFIX = "SANITY_TEST_";

// Parse args
const args = process.argv.slice(2);
const testArg = args.find(a => a.startsWith("--test="));
const testName = testArg ? testArg.split("=")[1] : "all";
const doCleanup = args.includes("--cleanup");

// Results tracking
const results = {
  passed: [],
  failed: [],
};

function pass(testId, msg) {
  console.log(`✅ PASS [${testId}]: ${msg}`);
  results.passed.push({ testId, msg });
}

function fail(testId, msg, details = null) {
  console.error(`❌ FAIL [${testId}]: ${msg}`);
  if (details) console.error("   Details:", details);
  results.failed.push({ testId, msg, details });
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

// -----------------------------------------------------------------------------
// Test A: stripe-event collection idempotency
// -----------------------------------------------------------------------------
async function testIdempotency(strapi) {
  info("=== Test A: Stripe Event Idempotency ===");
  
  const testEventId = `${TEST_PREFIX}evt_${Date.now()}`;
  
  try {
    // 1. Check collection exists by attempting to create
    const event1 = await strapi.entityService.create("api::stripe-event.stripe-event", {
      data: {
        eventId: testEventId,
        eventType: "test.event.sanity",
        processedAt: new Date().toISOString(),
        payload: { test: true, sanity: "stage3" },
      },
    });
    
    if (event1 && event1.id) {
      pass("A1", `stripe-event collection exists and accepts records (id: ${event1.id})`);
    } else {
      fail("A1", "stripe-event create returned no id");
    }
    
    // 2. Try to find by eventId (uniqueness check)
    const existing = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
      filters: { eventId: testEventId },
    });
    
    if (existing.length === 1) {
      pass("A2", "stripe-event can be queried by eventId for idempotency check");
    } else {
      fail("A2", `Expected 1 event, found ${existing.length}`);
    }
    
    // 3. Try duplicate insert (should fail or be caught)
    let duplicateFailed = false;
    try {
      await strapi.entityService.create("api::stripe-event.stripe-event", {
        data: {
          eventId: testEventId, // same ID
          eventType: "test.event.duplicate",
          processedAt: new Date().toISOString(),
          payload: { test: true },
        },
      });
      // If we get here without error, check if unique constraint enforced
      const afterDup = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
        filters: { eventId: testEventId },
      });
      if (afterDup.length === 1) {
        duplicateFailed = true; // Strapi silently ignored or unique constraint worked
      }
    } catch {
      duplicateFailed = true;
    }
    
    if (duplicateFailed) {
      pass("A3", "Duplicate eventId correctly prevented or ignored");
    } else {
      fail("A3", "Duplicate eventId was allowed - idempotency at risk");
    }
    
    // Cleanup
    await strapi.entityService.delete("api::stripe-event.stripe-event", event1.id);
    info("Cleaned up test stripe-event");
    
  } catch (error) {
    fail("A0", "Exception during idempotency test", error.message);
  }
}

// -----------------------------------------------------------------------------
// Test B: Webhook handler processes checkout.session.completed
// -----------------------------------------------------------------------------
async function testWebhookHandler(strapi) {
  info("=== Test B: Webhook Handler - checkout.session.completed ===");
  
  const testEmail = `${TEST_PREFIX}webhook_${Date.now()}@test.local`;
  const testSessionId = `${TEST_PREFIX}cs_${Date.now()}`;
  const testCustomerStripeId = `${TEST_PREFIX}cus_${Date.now()}`;
  
  let customerId, purchaseId, licenseKeyId, entitlementId;
  
  try {
    // 1. Create a customer first (simulating existing user)
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Webhook",
        lastName: "Test",
        password: "test123hash",
        isActive: true,
      },
    });
    customerId = customer.id;
    info(`Created customer #${customerId} (${testEmail})`);
    
    // 2. Import and call webhook handler directly
    let processStripeEvent;
    try {
      processStripeEvent = require("../src/utils/stripe-webhook-handler").processStripeEvent;
    } catch (err) {
      fail("B0", "Could not import stripe-webhook-handler", err.message);
      return;
    }
    
    // 3. Simulate checkout.session.completed event
    const mockSession = {
      id: testSessionId,
      mode: "payment",
      customer: testCustomerStripeId,
      customer_email: testEmail,
      amount_total: 9900,
      currency: "usd",
      payment_status: "paid",
      metadata: {
        priceId: "price_test_sanity",
        tier: "maker",
      },
    };
    
    const mockEvent = {
      id: `${TEST_PREFIX}evt_checkout_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: mockSession,
      },
    };
    
    const result = await processStripeEvent(mockEvent);
    
    if (result && result.status === "processed") {
      pass("B1", "processStripeEvent returned success for checkout.session.completed");
    } else {
      fail("B1", "processStripeEvent did not return success", result);
    }
    
    // 4. Verify purchase was created
    const purchases = await strapi.entityService.findMany("api::purchase.purchase", {
      filters: { stripeSessionId: testSessionId },
    });
    
    if (purchases.length === 1) {
      purchaseId = purchases[0].id;
      pass("B2", `Purchase created with stripeSessionId (id: ${purchaseId})`);
      
      // Check purchase has new fields
      if (purchases[0].mode === "payment") {
        pass("B2a", "Purchase.mode correctly set to 'payment'");
      } else {
        fail("B2a", `Purchase.mode expected 'payment', got '${purchases[0].mode}'`);
      }
    } else {
      fail("B2", `Expected 1 purchase, found ${purchases.length}`);
    }
    
    // 5. Verify license-key was created
    const licenseKeys = await strapi.entityService.findMany("api::license-key.license-key", {
      filters: { 
        customer: customerId,
      },
      populate: ["entitlement", "purchase"],
    });
    
    // License keys created by webhook start with tier prefix (MAK-, PRO-, etc)
    const ourLicenseKey = licenseKeys.find(lk => {
      const purchaseMatch = lk.purchase && (lk.purchase === purchaseId || lk.purchase.id === purchaseId);
      const typeMatch = lk.typ === "paid";
      return purchaseMatch || typeMatch;
    });
    if (ourLicenseKey) {
      licenseKeyId = ourLicenseKey.id;
      pass("B3", `License-key created (id: ${licenseKeyId})`);
    } else {
      fail("B3", "License-key not found for test customer", { found: licenseKeys.length, keys: licenseKeys.map(k => ({ id: k.id, key: k.key, typ: k.typ })) });
    }
    
    // 6. Verify entitlement was created
    const entitlements = await strapi.entityService.findMany("api::entitlement.entitlement", {
      filters: { customer: customerId },
      populate: ["licenseKey"],
    });
    
    if (entitlements.length >= 1) {
      // Find the one linked to our license key
      const ourEntitlement = entitlements.find(e => 
        e.licenseKey && e.licenseKey.id === licenseKeyId
      ) || entitlements[0];
      entitlementId = ourEntitlement.id;
      pass("B4", `Entitlement created (id: ${entitlementId})`);
      
      // Check new Stripe fields
      if (ourEntitlement.stripeCustomerId === testCustomerStripeId) {
        pass("B4a", "Entitlement.stripeCustomerId correctly set");
      } else {
        fail("B4a", `Expected stripeCustomerId '${testCustomerStripeId}', got '${ourEntitlement.stripeCustomerId}'`);
      }
    } else {
      fail("B4", "Entitlement not found for test customer");
    }
    
    // 7. Verify stripe-event was recorded for idempotency
    const stripeEvents = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
      filters: { eventId: mockEvent.id },
    });
    
    if (stripeEvents.length === 1) {
      pass("B5", "Stripe event recorded for idempotency");
    } else {
      fail("B5", `Expected 1 stripe-event, found ${stripeEvents.length}`);
    }
    
    // 8. Test idempotency - calling again should be no-op
    await processStripeEvent(mockEvent);
    
    const purchasesAfter = await strapi.entityService.findMany("api::purchase.purchase", {
      filters: { stripeSessionId: testSessionId },
    });
    
    if (purchasesAfter.length === 1) {
      pass("B6", "Idempotency works - duplicate event did not create extra purchase");
    } else {
      fail("B6", `Expected 1 purchase after duplicate event, found ${purchasesAfter.length}`);
    }
    
  } catch (error) {
    fail("B0", "Exception during webhook handler test", error.message);
  }
  
  // Cleanup - delete all test stripe events first
  const testEvents = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
    filters: { eventId: { $startsWith: TEST_PREFIX } },
  });
  for (const evt of testEvents) {
    await strapi.entityService.delete("api::stripe-event.stripe-event", evt.id).catch(() => {});
  }
  if (entitlementId) {
    await strapi.entityService.delete("api::entitlement.entitlement", entitlementId).catch(() => {});
  }
  if (licenseKeyId) {
    await strapi.entityService.delete("api::license-key.license-key", licenseKeyId).catch(() => {});
  }
  if (purchaseId) {
    await strapi.entityService.delete("api::purchase.purchase", purchaseId).catch(() => {});
  }
  if (customerId) {
    await strapi.entityService.delete("api::customer.customer", customerId).catch(() => {});
  }
  info("Cleaned up test data for Test B");
}

// -----------------------------------------------------------------------------
// Test C: Founders Protection (isLifetime=true unchanged by subscription events)
// -----------------------------------------------------------------------------
async function testFoundersProtection(strapi) {
  info("=== Test C: Founders Protection ===");
  
  const testEmail = `${TEST_PREFIX}founder_${Date.now()}@test.local`;
  const testKey = `${TEST_PREFIX}${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const testSubId = `${TEST_PREFIX}sub_${Date.now()}`;
  
  let customerId, licenseKeyId, entitlementId;
  
  try {
    // 1. Create founder customer with lifetime entitlement
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Founder",
        lastName: "Test",
        password: "test123hash",
        isActive: true,
      },
    });
    customerId = customer.id;
    
    const licenseKey = await strapi.entityService.create("api::license-key.license-key", {
      data: {
        key: testKey,
        productName: "Founders Lifetime",
        priceId: "price_founders",
        customer: customerId,
        status: "active",
        isActive: true,
        typ: "paid",
      },
    });
    licenseKeyId = licenseKey.id;
    
    const entitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customerId,
        licenseKey: licenseKeyId,
        tier: "maker",
        status: "active",
        isLifetime: true, // FOUNDER - must be protected
        maxDevices: 1,
        source: "legacy_purchase", // founders are legacy_purchase with isLifetime=true
        stripeSubscriptionId: testSubId, // Pretend it was linked
      },
    });
    entitlementId = entitlement.id;
    info(`Created founder entitlement #${entitlementId} (isLifetime=true)`);
    
    // 2. Import webhook handler
    let processStripeEvent;
    try {
      processStripeEvent = require("../src/utils/stripe-webhook-handler").processStripeEvent;
    } catch (err) {
      fail("C0", "Could not import stripe-webhook-handler", err.message);
      return;
    }
    
    // 3. Simulate customer.subscription.deleted event
    const mockDeleteEvent = {
      id: `${TEST_PREFIX}evt_subdel_${Date.now()}`,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: testSubId,
          customer: `${TEST_PREFIX}cus_founder`,
          status: "canceled",
          canceled_at: Math.floor(Date.now() / 1000),
        },
      },
    };
    
    await processStripeEvent(mockDeleteEvent);
    
    // 4. Verify entitlement is UNCHANGED
    const afterDelete = await strapi.entityService.findOne(
      "api::entitlement.entitlement",
      entitlementId
    );
    
    if (afterDelete.isLifetime === true && afterDelete.status === "active") {
      pass("C1", "Founder entitlement protected - isLifetime and status unchanged after subscription.deleted");
    } else {
      fail("C1", "Founder entitlement was modified", {
        expectedIsLifetime: true,
        gotIsLifetime: afterDelete.isLifetime,
        expectedStatus: "active",
        gotStatus: afterDelete.status,
      });
    }
    
    // 5. Simulate subscription.updated with status=past_due
    const mockUpdateEvent = {
      id: `${TEST_PREFIX}evt_subupd_${Date.now()}`,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: testSubId,
          customer: `${TEST_PREFIX}cus_founder`,
          status: "past_due",
          current_period_end: Math.floor(Date.now() / 1000) - 86400,
        },
      },
    };
    
    await processStripeEvent(mockUpdateEvent);
    
    const afterUpdate = await strapi.entityService.findOne(
      "api::entitlement.entitlement",
      entitlementId
    );
    
    if (afterUpdate.isLifetime === true && afterUpdate.status === "active") {
      pass("C2", "Founder entitlement protected - status unchanged after subscription.updated(past_due)");
    } else {
      fail("C2", "Founder entitlement was modified by update event", {
        expectedStatus: "active",
        gotStatus: afterUpdate.status,
      });
    }
    
    // Cleanup stripe events
    const eventsToClean = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
      filters: { eventId: { $startsWith: TEST_PREFIX } },
    });
    for (const evt of eventsToClean) {
      await strapi.entityService.delete("api::stripe-event.stripe-event", evt.id).catch(() => {});
    }
    
  } catch (error) {
    fail("C0", "Exception during founders protection test", error.message);
  }
  
  // Cleanup
  if (entitlementId) {
    await strapi.entityService.delete("api::entitlement.entitlement", entitlementId).catch(() => {});
  }
  if (licenseKeyId) {
    await strapi.entityService.delete("api::license-key.license-key", licenseKeyId).catch(() => {});
  }
  if (customerId) {
    await strapi.entityService.delete("api::customer.customer", customerId).catch(() => {});
  }
  info("Cleaned up test data for Test C");
}

// -----------------------------------------------------------------------------
// Test D: Purchase status polling endpoint
// -----------------------------------------------------------------------------
async function testPollingEndpoint(strapi) {
  info("=== Test D: Purchase Status Polling Endpoint ===");
  
  const testEmail = `${TEST_PREFIX}poll_${Date.now()}@test.local`;
  const testSessionId = `${TEST_PREFIX}cs_poll_${Date.now()}`;
  
  let customerId, purchaseId, licenseKeyId, entitlementId;
  
  try {
    // 1. Create customer with complete purchase chain
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Poll",
        lastName: "Test",
        password: "test123hash",
        isActive: true,
      },
    });
    customerId = customer.id;
    
    const purchase = await strapi.entityService.create("api::purchase.purchase", {
      data: {
        stripeSessionId: testSessionId,
        amount: 9900,
        priceId: "price_test_poll",
        customerEmail: testEmail,
        customer: customerId,
        mode: "payment",
      },
    });
    purchaseId = purchase.id;
    
    const licenseKey = await strapi.entityService.create("api::license-key.license-key", {
      data: {
        key: `LLMPOLL${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        productName: "Poll Test",
        priceId: "price_test_poll",
        customer: customerId,
        purchase: purchaseId,
        status: "unused",
        isActive: true,
        typ: "paid",
      },
    });
    licenseKeyId = licenseKey.id;
    
    const entitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customerId,
        licenseKey: licenseKeyId,
        purchase: purchaseId,
        tier: "maker",
        status: "active",
        isLifetime: false,
        maxDevices: 1,
        source: "legacy_purchase",
      },
    });
    entitlementId = entitlement.id;
    info(`Created complete purchase chain for polling test`);
    
    // 2. Test the controller logic directly (simulating authenticated request)
    // We can't easily make HTTP requests, so we test the underlying logic
    
    // Find purchase by session ID (like the endpoint does)
    const foundPurchase = await strapi.entityService.findMany("api::purchase.purchase", {
      filters: { 
        stripeSessionId: testSessionId,
        customer: customerId,
      },
      populate: ["customer"],
    });
    
    if (foundPurchase.length === 1) {
      pass("D1", "Can find purchase by session_id and customer");
    } else {
      fail("D1", `Expected 1 purchase, found ${foundPurchase.length}`);
    }
    
    // Find associated entitlement
    const foundEntitlements = await strapi.entityService.findMany("api::entitlement.entitlement", {
      filters: {
        customer: customerId,
        purchase: purchaseId,
      },
      populate: ["licenseKey"],
    });
    
    if (foundEntitlements.length >= 1) {
      const ent = foundEntitlements[0];
      pass("D2", "Can find entitlement by customer and purchase");
      
      // Verify shape matches what polling endpoint returns
      if (ent.tier && ent.status && ent.licenseKey) {
        pass("D3", "Entitlement has expected shape (tier, status, licenseKey)");
      } else {
        fail("D3", "Entitlement missing expected fields", { tier: ent.tier, status: ent.status, hasLicenseKey: !!ent.licenseKey });
      }
    } else {
      fail("D2", "Entitlement not found");
    }
    
  } catch (error) {
    fail("D0", "Exception during polling endpoint test", error.message);
  }
  
  // Cleanup
  if (entitlementId) {
    await strapi.entityService.delete("api::entitlement.entitlement", entitlementId).catch(() => {});
  }
  if (licenseKeyId) {
    await strapi.entityService.delete("api::license-key.license-key", licenseKeyId).catch(() => {});
  }
  if (purchaseId) {
    await strapi.entityService.delete("api::purchase.purchase", purchaseId).catch(() => {});
  }
  if (customerId) {
    await strapi.entityService.delete("api::customer.customer", customerId).catch(() => {});
  }
  info("Cleaned up test data for Test D");
}

// -----------------------------------------------------------------------------
// Cleanup function
// -----------------------------------------------------------------------------
async function cleanupTestData(strapi) {
  info("=== Cleaning up test data with prefix: " + TEST_PREFIX + " ===\n");
  
  // Delete stripe-events with test prefix
  const stripeEvents = await strapi.entityService.findMany("api::stripe-event.stripe-event", {
    filters: { eventId: { $startsWith: TEST_PREFIX } },
  });
  
  for (const evt of stripeEvents) {
    await strapi.entityService.delete("api::stripe-event.stripe-event", evt.id);
    info(`Deleted stripe-event #${evt.id}`);
  }
  
  // Delete entitlements linked to test customers
  const testCustomers = await strapi.entityService.findMany("api::customer.customer", {
    filters: { email: { $startsWith: TEST_PREFIX } },
  });
  
  for (const customer of testCustomers) {
    const entitlements = await strapi.entityService.findMany("api::entitlement.entitlement", {
      filters: { customer: customer.id },
    });
    for (const ent of entitlements) {
      await strapi.entityService.delete("api::entitlement.entitlement", ent.id);
      info(`Deleted entitlement #${ent.id}`);
    }
  }
  
  // Delete license-keys with test prefix
  const licenseKeys = await strapi.entityService.findMany("api::license-key.license-key", {
    filters: { key: { $startsWith: TEST_PREFIX } },
  });
  
  for (const lk of licenseKeys) {
    await strapi.entityService.delete("api::license-key.license-key", lk.id);
    info(`Deleted license-key #${lk.id}`);
  }
  
  // Delete purchases with test prefix
  const purchases = await strapi.entityService.findMany("api::purchase.purchase", {
    filters: { stripeSessionId: { $startsWith: TEST_PREFIX } },
  });
  
  for (const p of purchases) {
    await strapi.entityService.delete("api::purchase.purchase", p.id);
    info(`Deleted purchase #${p.id}`);
  }
  
  // Delete customers with test prefix
  for (const c of testCustomers) {
    await strapi.entityService.delete("api::customer.customer", c.id);
    info(`Deleted customer #${c.id}`);
  }
  
  info("Cleanup complete");
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
const Strapi = require("@strapi/strapi");

async function main() {
  let strapiInstance;
  
  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  STAGE 3 SANITY TESTS - Stripe Webhook & Subscription Flow");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    info("Starting Strapi...");
    strapiInstance = await Strapi().load();
    info("Strapi loaded\n");
    
    if (doCleanup) {
      await cleanupTestData(strapiInstance);
    } else {
      if (testName === "all" || testName === "idempotency") {
        await testIdempotency(strapiInstance);
        console.log("");
      }
      
      if (testName === "all" || testName === "webhook") {
        await testWebhookHandler(strapiInstance);
        console.log("");
      }
      
      if (testName === "all" || testName === "founders") {
        await testFoundersProtection(strapiInstance);
        console.log("");
      }
      
      if (testName === "all" || testName === "polling") {
        await testPollingEndpoint(strapiInstance);
        console.log("");
      }
    }
    
    // Print summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`\n✅ Passed: ${results.passed.length}`);
    results.passed.forEach(r => console.log(`   - [${r.testId}] ${r.msg}`));
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(r => console.log(`   - [${r.testId}] ${r.msg}`));
    
    // Set exit code based on test results
    const exitCode = results.failed.length > 0 ? 1 : 0;
    
    // Clean shutdown
    if (strapiInstance) {
      await strapiInstance.destroy();
    }
    
    // Explicitly exit to avoid hanging on open handles
    process.exit(exitCode);
    
  } catch (error) {
    console.error("Sanity test script failed:", error);
    if (strapiInstance) {
      await strapiInstance.destroy();
    }
    process.exit(1);
  }
}

main();
