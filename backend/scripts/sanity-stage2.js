#!/usr/bin/env node
/**
 * Stage 2 Sanity Tests - Entitlement 1:1 Model Validation
 * 
 * Tests:
 * A) Strapi 1:1 relation correctness
 * B) Backfill script idempotency (run separately via make targets)
 * C) Activation path creates entitlement if missing + enforces state
 * D) Customer entitlements endpoint returns correct shape
 * E) Repair script alignment (review only - logs findings)
 * 
 * Usage:
 *   node scripts/sanity-stage2.js --test=relations
 *   node scripts/sanity-stage2.js --test=activation
 *   node scripts/sanity-stage2.js --test=endpoint
 *   node scripts/sanity-stage2.js --test=all
 *   node scripts/sanity-stage2.js --cleanup  (removes test data)
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
// Test A: 1:1 Relation Correctness
// -----------------------------------------------------------------------------
async function testRelations(strapi) {
  info("=== Test A: 1:1 Relation Correctness ===");
  
  const testEmail = `${TEST_PREFIX}${Date.now()}@test.local`;
  const testKey = `${TEST_PREFIX}${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  
  let customerId, purchaseId, licenseKeyId, entitlementId;
  
  try {
    // 1. Create customer
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Sanity",
        lastName: "Test",
        password: "test123hash",
        isActive: true,
      },
    });
    customerId = customer.id;
    info(`Created customer #${customerId} (${testEmail})`);
    
    // 2. Create purchase
    const purchase = await strapi.entityService.create("api::purchase.purchase", {
      data: {
        stripeSessionId: `${TEST_PREFIX}session_${Date.now()}`,
        amount: 99.00,
        priceId: "price_test_sanity",
        customerEmail: testEmail,
        customer: customerId,
      },
    });
    purchaseId = purchase.id;
    info(`Created purchase #${purchaseId}`);
    
    // 3. Create license-key linked to purchase + customer
    const licenseKey = await strapi.entityService.create("api::license-key.license-key", {
      data: {
        key: testKey,
        productName: "Sanity Test Product",
        priceId: "price_test_sanity",
        customer: customerId,
        purchase: purchaseId,
        status: "unused",
        isActive: true,
        typ: "paid",
      },
    });
    licenseKeyId = licenseKey.id;
    info(`Created license-key #${licenseKeyId} (${testKey})`);
    
    // 4. Create entitlement linked 1:1 to license-key
    const entitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customerId,
        licenseKey: licenseKeyId,
        purchase: purchaseId,
        tier: "maker",
        status: "active",
        isLifetime: true,
        maxDevices: 1,
        source: "legacy_purchase",
        metadata: { test: true, createdBy: "sanity-stage2" },
      },
    });
    entitlementId = entitlement.id;
    info(`Created entitlement #${entitlementId}`);
    
    // 5. Verify persistence BOTH ways after reload
    // Check license-key.entitlement
    const reloadedLicenseKey = await strapi.entityService.findOne(
      "api::license-key.license-key",
      licenseKeyId,
      { populate: ["entitlement"] }
    );
    
    if (reloadedLicenseKey.entitlement && reloadedLicenseKey.entitlement.id === entitlementId) {
      pass("A1", `license-key.entitlement correctly links to entitlement #${entitlementId}`);
    } else {
      fail("A1", "license-key.entitlement NOT set correctly", {
        expected: entitlementId,
        got: reloadedLicenseKey.entitlement,
      });
    }
    
    // Check entitlement.licenseKey
    const reloadedEntitlement = await strapi.entityService.findOne(
      "api::entitlement.entitlement",
      entitlementId,
      { populate: ["licenseKey"] }
    );
    
    if (reloadedEntitlement.licenseKey && reloadedEntitlement.licenseKey.id === licenseKeyId) {
      pass("A2", `entitlement.licenseKey correctly links to license-key #${licenseKeyId}`);
    } else {
      fail("A2", "entitlement.licenseKey NOT set correctly", {
        expected: licenseKeyId,
        got: reloadedEntitlement.licenseKey,
      });
    }
    
    // Verify customer relation
    if (reloadedEntitlement.customer || entitlement.customer) {
      const entWithCustomer = await strapi.entityService.findOne(
        "api::entitlement.entitlement",
        entitlementId,
        { populate: ["customer"] }
      );
      if (entWithCustomer.customer && entWithCustomer.customer.id === customerId) {
        pass("A3", `entitlement.customer correctly links to customer #${customerId}`);
      } else {
        fail("A3", "entitlement.customer NOT set correctly", {
          expected: customerId,
          got: entWithCustomer.customer,
        });
      }
    }
    
  } catch (error) {
    fail("A0", "Exception during relation test", error.message);
  }
  
  // Cleanup test data
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
  info("Cleaned up test data for Test A");
}

// -----------------------------------------------------------------------------
// Test C: Activation Path - Auto-create entitlement + enforce state
// -----------------------------------------------------------------------------
async function testActivation(strapi) {
  info("=== Test C: Activation Path ===");
  
  const testEmail = `${TEST_PREFIX}activation_${Date.now()}@test.local`;
  const testKey = `${TEST_PREFIX}ACT_${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  
  let customerId, purchaseId, licenseKeyId, createdEntitlementId;
  let activatedLicenseKey = null;  // Track the new key after activation
  
  try {
    // Setup: Create customer, purchase, license-key WITHOUT entitlement
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Activation",
        lastName: "Test",
        password: "test123hash",
        isActive: true,
      },
    });
    customerId = customer.id;
    
    const purchase = await strapi.entityService.create("api::purchase.purchase", {
      data: {
        stripeSessionId: `${TEST_PREFIX}act_session_${Date.now()}`,
        amount: 99.00,
        priceId: "price_test_activation",
        customerEmail: testEmail,
        customer: customerId,
      },
    });
    purchaseId = purchase.id;
    
    const licenseKey = await strapi.entityService.create("api::license-key.license-key", {
      data: {
        key: testKey,
        productName: "Activation Test Product",
        priceId: "price_test_activation",
        customer: customerId,
        purchase: purchaseId,
        status: "unused",
        isActive: true,
        typ: "starter",
      },
    });
    licenseKeyId = licenseKey.id;
    info(`Created license-key #${licenseKeyId} WITHOUT entitlement (simulating legacy)`);
    
    // Verify no entitlement exists
    const beforeActivation = await strapi.entityService.findOne(
      "api::license-key.license-key",
      licenseKeyId,
      { populate: ["entitlement"] }
    );
    
    if (!beforeActivation.entitlement) {
      pass("C1", "License-key has no entitlement before activation (legacy simulation)");
    } else {
      fail("C1", "License-key unexpectedly has entitlement before test");
    }
    
    // Test C2: Simulate activation call via HTTP
    // We'll use node's http to call the actual endpoint
    const http = require("http");
    
    const activationPayload = JSON.stringify({
      licenceKey: testKey,  // Note: API uses "licenceKey" spelling
      machineId: "sanity-test-machine-001",
    });
    
    const activationResult = await new Promise((resolve) => {
      const req = http.request({
        hostname: "localhost",
        port: 1337,
        path: "/api/license/activate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": activationPayload.length,
        },
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          resolve({ status: res.statusCode, body: data });
        });
      });
      req.on("error", (e) => resolve({ status: 0, error: e.message }));
      req.write(activationPayload);
      req.end();
    });
    
    info(`Activation response: ${activationResult.status}`);
    
    if (activationResult.status === 200) {
      pass("C2", "Activation succeeded for legacy license without entitlement");
      
      // Parse the response to get the new license key
      try {
        const activationData = JSON.parse(activationResult.body);
        if (activationData.licenseKey) {
          activatedLicenseKey = activationData.licenseKey;
          info(`New license key after activation: ${activatedLicenseKey}`);
        }
      } catch {}
      
      // Verify entitlement was auto-created
      const afterActivation = await strapi.entityService.findOne(
        "api::license-key.license-key",
        licenseKeyId,
        { populate: ["entitlement"] }
      );
      
      if (afterActivation.entitlement) {
        createdEntitlementId = afterActivation.entitlement.id;
        pass("C3", `Entitlement auto-created: #${createdEntitlementId}`);
        
        // Verify entitlement properties
        const entitlement = await strapi.entityService.findOne(
          "api::entitlement.entitlement",
          createdEntitlementId,
          { populate: ["licenseKey", "customer"] }
        );
        
        if (entitlement.status === "active") {
          pass("C4", "Auto-created entitlement has status='active'");
        } else {
          fail("C4", `Auto-created entitlement has wrong status: ${entitlement.status}`);
        }
        
        if (entitlement.licenseKey && entitlement.licenseKey.id === licenseKeyId) {
          pass("C5", "Auto-created entitlement correctly linked to license-key");
        } else {
          fail("C5", "Auto-created entitlement NOT linked to license-key");
        }
        
        if (entitlement.customer && entitlement.customer.id === customerId) {
          pass("C6", "Auto-created entitlement correctly linked to customer");
        } else {
          fail("C6", "Auto-created entitlement NOT linked to customer");
        }
        
        // Check metadata
        if (entitlement.metadata && entitlement.metadata.reason === "autocreated_on_activation") {
          pass("C7", "Auto-created entitlement has correct metadata.reason");
        } else {
          fail("C7", "Auto-created entitlement missing metadata.reason", entitlement.metadata);
        }
      } else {
        fail("C3", "Entitlement was NOT auto-created after activation");
      }
    } else {
      // Parse error
      let errBody;
      try { errBody = JSON.parse(activationResult.body); } catch { errBody = activationResult.body; }
      fail("C2", `Activation failed with status ${activationResult.status}`, errBody);
    }
    
  } catch (error) {
    fail("C0", "Exception during activation test", error.message);
  }
  
  // Test C8: Enforce entitlement status != active
  info("Testing entitlement enforcement (status != active)...");
  try {
    if (createdEntitlementId) {
      // Set entitlement to expired
      await strapi.entityService.update("api::entitlement.entitlement", createdEntitlementId, {
        data: { status: "expired" },
      });
      
      // Reset license to unused for re-activation attempt
      await strapi.entityService.update("api::license-key.license-key", licenseKeyId, {
        data: { status: "unused", jti: null, machineId: null },
      });
      
      // Use the activated key (not original testKey) since it was transformed
      const keyToUse = activatedLicenseKey || testKey;
      info(`Using license key for enforcement test: ${keyToUse}`);
      
      // Try to activate again
      const http = require("http");
      const payload = JSON.stringify({
        licenceKey: keyToUse,
        machineId: "sanity-test-machine-002",
      });
      
      const result = await new Promise((resolve) => {
        const req = http.request({
          hostname: "localhost",
          port: 1337,
          path: "/api/license/activate",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length,
          },
        }, (res) => {
          let data = "";
          res.on("data", chunk => data += chunk);
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        });
        req.on("error", (e) => resolve({ status: 0, error: e.message }));
        req.write(payload);
        req.end();
      });
      
      if (result.status === 403) {
        pass("C8", "Activation correctly rejected with 403 when entitlement is expired");
        try {
          const body = JSON.parse(result.body);
          if (body.entitlementStatus === "expired") {
            pass("C9", "Error response includes correct entitlementStatus");
          }
        } catch {}
      } else {
        fail("C8", `Expected 403 for expired entitlement, got ${result.status}`);
      }
    }
  } catch (error) {
    fail("C8", "Exception during enforcement test", error.message);
  }
  
  // Cleanup
  if (createdEntitlementId) {
    await strapi.entityService.delete("api::entitlement.entitlement", createdEntitlementId).catch(() => {});
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
  info("Cleaned up test data for Test C");
}

// -----------------------------------------------------------------------------
// Test D: Customer Entitlements Endpoint
// -----------------------------------------------------------------------------
async function testEndpoint(strapi) {
  info("=== Test D: Customer Entitlements Endpoint ===");
  
  // Use lowercase email to match login's toLowerCase() behavior
  const testEmail = `sanity_test_endpoint_${Date.now()}@test.local`.toLowerCase();
  const testPassword = "SanityTest123!";
  const testKey = `${TEST_PREFIX}EP_${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  
  let customerId, licenseKeyId, entitlementId;
  
  try {
    // Create customer with proper password
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: testEmail,
        firstName: "Endpoint",
        lastName: "Test",
        password: hashedPassword,
        isActive: true,
      },
    });
    customerId = customer.id;
    
    // Create license-key
    const licenseKey = await strapi.entityService.create("api::license-key.license-key", {
      data: {
        key: testKey,
        productName: "Endpoint Test Product",
        priceId: "price_endpoint_test",
        customer: customerId,
        status: "unused",
        isActive: true,
        typ: "pro",
      },
    });
    licenseKeyId = licenseKey.id;
    
    // Create entitlement
    const entitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customerId,
        licenseKey: licenseKeyId,
        tier: "pro",
        status: "active",
        isLifetime: true,
        maxDevices: 2,
        source: "legacy_purchase",
        metadata: { test: true },
      },
    });
    entitlementId = entitlement.id;
    
    info(`Created test data: customer #${customerId}, license #${licenseKeyId}, entitlement #${entitlementId}`);
    
    // Login to get token
    const http = require("http");
    const loginPayload = JSON.stringify({ email: testEmail, password: testPassword });
    
    const loginResult = await new Promise((resolve) => {
      const req = http.request({
        hostname: "localhost",
        port: 1337,
        path: "/api/customers/login",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": loginPayload.length,
        },
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });
      req.on("error", (e) => resolve({ status: 0, error: e.message }));
      req.write(loginPayload);
      req.end();
    });
    
    if (loginResult.status !== 200) {
      fail("D1", `Customer login failed: ${loginResult.status}`, loginResult.body);
      return;
    }
    
    const loginData = JSON.parse(loginResult.body);
    const token = loginData.token;
    pass("D1", "Customer login succeeded");
    
    // Call entitlements endpoint
    const entitlementsResult = await new Promise((resolve) => {
      const req = http.request({
        hostname: "localhost",
        port: 1337,
        path: "/api/customers/entitlements",
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });
      req.on("error", (e) => resolve({ status: 0, error: e.message }));
      req.end();
    });
    
    if (entitlementsResult.status !== 200) {
      fail("D2", `Entitlements endpoint failed: ${entitlementsResult.status}`);
      return;
    }
    
    pass("D2", "Entitlements endpoint returned 200");
    
    const entitlementsData = JSON.parse(entitlementsResult.body);
    
    // Verify structure
    if (Array.isArray(entitlementsData.entitlements)) {
      pass("D3", "Response contains entitlements array");
      
      const ourEntitlement = entitlementsData.entitlements.find(e => e.id === entitlementId);
      if (ourEntitlement) {
        pass("D4", "Our test entitlement is in the response");
        
        // Check licenseKey is populated
        if (ourEntitlement.licenseKey && ourEntitlement.licenseKey.id === licenseKeyId) {
          pass("D5", "licenseKey relation is populated correctly");
        } else {
          fail("D5", "licenseKey relation NOT populated", ourEntitlement);
        }
        
        // Check no secrets leaked
        if (!ourEntitlement.licenseKey?.deactivationCode && !ourEntitlement.licenseKey?.activationNonce) {
          pass("D6", "No sensitive fields leaked in response");
        } else {
          fail("D6", "Sensitive fields may be leaked");
        }
        
        // Log sample payload (redacted)
        info("Sample response payload:");
        console.log(JSON.stringify({
          ...ourEntitlement,
          licenseKey: ourEntitlement.licenseKey ? {
            id: ourEntitlement.licenseKey.id,
            key: "[REDACTED]",
            typ: ourEntitlement.licenseKey.typ,
          } : null,
        }, null, 2));
      } else {
        fail("D4", "Test entitlement NOT in response");
      }
    } else {
      fail("D3", "Response does not contain entitlements array", entitlementsData);
    }
    
    // Check meta
    if (entitlementsData.meta && typeof entitlementsData.meta.total === "number") {
      pass("D7", "Response includes meta.total");
    }
    
  } catch (error) {
    fail("D0", "Exception during endpoint test", error.message);
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
  info("Cleaned up test data for Test D");
}

// -----------------------------------------------------------------------------
// Cleanup all test data
// -----------------------------------------------------------------------------
async function cleanupTestData(strapi) {
  info("=== Cleaning up all sanity test data ===");
  
  // Delete entitlements with test metadata
  const entitlements = await strapi.entityService.findMany("api::entitlement.entitlement", {
    filters: {
      $or: [
        { metadata: { $containsi: "sanity" } },
        { metadata: { $containsi: TEST_PREFIX } },
      ],
    },
  });
  
  for (const e of entitlements) {
    await strapi.entityService.delete("api::entitlement.entitlement", e.id);
    info(`Deleted entitlement #${e.id}`);
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
  const customers = await strapi.entityService.findMany("api::customer.customer", {
    filters: { email: { $startsWith: TEST_PREFIX } },
  });
  
  for (const c of customers) {
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
    console.log("  STAGE 2 SANITY TESTS - Entitlement 1:1 Model");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    info("Starting Strapi...");
    strapiInstance = await Strapi().load();
    info("Strapi loaded\n");
    
    if (doCleanup) {
      await cleanupTestData(strapiInstance);
    } else {
      if (testName === "all" || testName === "relations") {
        await testRelations(strapiInstance);
        console.log("");
      }
      
      if (testName === "all" || testName === "activation") {
        await testActivation(strapiInstance);
        console.log("");
      }
      
      if (testName === "all" || testName === "endpoint") {
        await testEndpoint(strapiInstance);
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
