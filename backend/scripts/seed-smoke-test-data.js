#!/usr/bin/env node
/**
 * seed-smoke-test-data.js - Create test data for smoke tests
 * 
 * Usage (from inside Docker container):
 *   node scripts/seed-smoke-test-data.js
 * 
 * Or via Makefile:
 *   make seed-test-customer
 * 
 * Creates:
 *   - Smoke test customer (if not exists)
 *   - One SUBSCRIPTION entitlement (tier=maker, isLifetime=false)
 *   - One LIFETIME entitlement (tier=pro, isLifetime=true)
 * 
 * Idempotent: reuses existing records, never creates duplicates.
 */

const bcrypt = require("bcrypt");

// Test customer configuration
const TEST_EMAIL = "smoketest@example.com";
const TEST_PASSWORD = "SmokeTest123!";
const TEST_FIRST_NAME = "Smoke";
const TEST_LAST_NAME = "Test";

// Entitlement prefixes for identification
const SUBSCRIPTION_KEY = "SMOKE-SUB-001";
const LIFETIME_KEY = "SMOKE-LIFE-001";

async function seed() {
  console.log("🌱 Seeding smoke test data...\n");

  // 1. Find or create test customer
  console.log("1. Customer...");
  let customer = await strapi.entityService.findMany("api::customer.customer", {
    filters: { email: TEST_EMAIL },
    limit: 1,
  });

  if (customer.length > 0) {
    customer = customer[0];
    console.log(`   ✓ Found existing customer #${customer.id} (${TEST_EMAIL})`);
  } else {
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
    customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: TEST_EMAIL,
        password: hashedPassword,
        firstName: TEST_FIRST_NAME,
        lastName: TEST_LAST_NAME,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`   ✓ Created customer #${customer.id} (${TEST_EMAIL})`);
  }

  // 2. Find or create SUBSCRIPTION entitlement
  console.log("\n2. Subscription entitlement...");
  let subEntitlement = await strapi.entityService.findMany(
    "api::entitlement.entitlement",
    {
      filters: {
        customer: customer.id,
        isLifetime: false,
        source: "subscription",
      },
      limit: 1,
    }
  );

  if (subEntitlement.length > 0) {
    subEntitlement = subEntitlement[0];
    console.log(`   ✓ Found existing subscription entitlement #${subEntitlement.id}`);
  } else {
    // First create a license key for the entitlement
    let subLicenseKey = await strapi.entityService.findMany(
      "api::license-key.license-key",
      { filters: { key: SUBSCRIPTION_KEY }, limit: 1 }
    );

    if (subLicenseKey.length > 0) {
      subLicenseKey = subLicenseKey[0];
    } else {
      subLicenseKey = await strapi.entityService.create("api::license-key.license-key", {
        data: {
          key: SUBSCRIPTION_KEY,
          productName: "Smoke Test Subscription",
          priceId: "price_smoke_subscription",
          customer: customer.id,
          status: "active",
          isActive: true,
          typ: "paid",
        },
      });
      console.log(`   ✓ Created license key #${subLicenseKey.id} (${SUBSCRIPTION_KEY})`);
    }

    // Create subscription entitlement (not lifetime, simulates monthly/yearly subscription)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    subEntitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customer.id,
        licenseKey: subLicenseKey.id,
        tier: "maker",
        status: "active",
        isLifetime: false,
        maxDevices: 2,
        source: "subscription",
        expiresAt: futureDate.toISOString(),
        currentPeriodEnd: futureDate.toISOString(),
        metadata: { test: true, createdBy: "seed-smoke-test-data" },
      },
    });
    console.log(`   ✓ Created subscription entitlement #${subEntitlement.id} (tier=maker, isLifetime=false)`);
  }

  // 3. Find or create LIFETIME entitlement
  console.log("\n3. Lifetime entitlement...");
  let lifeEntitlement = await strapi.entityService.findMany(
    "api::entitlement.entitlement",
    {
      filters: {
        customer: customer.id,
        isLifetime: true,
      },
      limit: 1,
    }
  );

  if (lifeEntitlement.length > 0) {
    lifeEntitlement = lifeEntitlement[0];
    console.log(`   ✓ Found existing lifetime entitlement #${lifeEntitlement.id}`);
  } else {
    // First create a license key for the entitlement
    let lifeLicenseKey = await strapi.entityService.findMany(
      "api::license-key.license-key",
      { filters: { key: LIFETIME_KEY }, limit: 1 }
    );

    if (lifeLicenseKey.length > 0) {
      lifeLicenseKey = lifeLicenseKey[0];
    } else {
      lifeLicenseKey = await strapi.entityService.create("api::license-key.license-key", {
        data: {
          key: LIFETIME_KEY,
          productName: "Smoke Test Lifetime",
          priceId: "price_smoke_lifetime",
          customer: customer.id,
          status: "active",
          isActive: true,
          typ: "paid",
        },
      });
      console.log(`   ✓ Created license key #${lifeLicenseKey.id} (${LIFETIME_KEY})`);
    }

    // Create lifetime entitlement (isLifetime=true, no expiry)
    lifeEntitlement = await strapi.entityService.create("api::entitlement.entitlement", {
      data: {
        customer: customer.id,
        licenseKey: lifeLicenseKey.id,
        tier: "pro",
        status: "active",
        isLifetime: true,
        maxDevices: 3,
        source: "legacy_purchase",
        metadata: { test: true, createdBy: "seed-smoke-test-data" },
      },
    });
    console.log(`   ✓ Created lifetime entitlement #${lifeEntitlement.id} (tier=pro, isLifetime=true)`);
  }

  // 4. Find or create test device (REUSE-OR-FAIL: never reassign from another customer)
  console.log("\n4. Test device...");
  const TEST_DEVICE_ID = "smoke-test-device-001";
  const TEST_PUBLIC_KEY = "smoke-test-public-key-12345678901234567890";
  
  let devices = await strapi.entityService.findMany("api::device.device", {
    filters: { deviceId: TEST_DEVICE_ID },
    populate: ["customer"],
    limit: 1,
  });
  
  if (devices.length > 0) {
    const device = devices[0];
    const deviceCustomerId = device.customer?.id || device.customer;
    
    if (deviceCustomerId === customer.id) {
      console.log(`   ✓ Found existing device #${device.id} (already owned by test customer)`);
    } else if (!deviceCustomerId) {
      // Device exists but has no owner - safe to claim
      await strapi.entityService.update("api::device.device", device.id, {
        data: {
          customer: customer.id,
          status: "active",
        },
      });
      console.log(`   ✓ Claimed orphan device #${device.id} for test customer`);
    } else {
      // Device belongs to another customer - FAIL, do not reassign
      console.error(`\n❌ ERROR: Device "${TEST_DEVICE_ID}" exists but belongs to customer #${deviceCustomerId}`);
      console.error(`   This is NOT the smoke test customer (ID: ${customer.id}).`);
      console.error(`\n   To fix this, either:`);
      console.error(`   1. Delete the device in Strapi admin: Content Manager > Devices > "${TEST_DEVICE_ID}"`);
      console.error(`   2. Or deactivate it via API if it's activated on an entitlement`);
      console.error(`\n   We do NOT auto-reassign devices to prevent data corruption.\n`);
      throw new Error(`Device "${TEST_DEVICE_ID}" owned by different customer #${deviceCustomerId}`);
    }
  } else {
    // Create new device
    const crypto = require("crypto");
    const publicKeyHash = crypto
      .createHash("sha256")
      .update(TEST_PUBLIC_KEY)
      .digest("hex")
      .slice(0, 16);
      
    await strapi.entityService.create("api::device.device", {
      data: {
        deviceId: TEST_DEVICE_ID,
        deviceName: "Smoke Test Device",
        publicKey: TEST_PUBLIC_KEY,
        publicKeyHash,
        platform: "test",
        status: "active",
        customer: customer.id,
      },
    });
    console.log(`   ✓ Created device (${TEST_DEVICE_ID})`);
  }

  // Summary
  console.log("\n========================================");
  console.log("✅ Smoke test data ready!");
  console.log("========================================");
  console.log(`Customer: ${TEST_EMAIL} (ID: ${customer.id})`);
  console.log(`Subscription Entitlement ID: ${subEntitlement.id}`);
  console.log(`Lifetime Entitlement ID: ${lifeEntitlement.id}`);
  console.log("\nRun smoke tests with:");
  console.log("  make smoke");
  console.log("========================================\n");

  return {
    customerId: customer.id,
    subscriptionEntitlementId: subEntitlement.id,
    lifetimeEntitlementId: lifeEntitlement.id,
  };
}

// Bootstrap Strapi and run
async function main() {
  // Check if we're already in Strapi context
  if (typeof strapi !== "undefined") {
    return seed();
  }
  
  // Bootstrap Strapi
  const strapiFactory = require("@strapi/strapi");
  const app = await strapiFactory().load();
  
  // Make strapi global
  global.strapi = app;
  
  try {
    await seed();
  } finally {
    await app.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
