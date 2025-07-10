#!/usr/bin/env node

const testDataSeeder = require("./test-data-seeder");

// This is a standalone script to just create the license keys
async function createLicenseKeys() {
  console.log("🔑 Creating test license keys directly...");

  // Simple HTTP requests to create license keys
  const fetch = require("node-fetch").default || fetch || require("node-fetch");

  const testLicenses = [
    {
      key: "TRIAL-CNC-001-DEMO",
      productName: "CNC Pro Trial",
      priceId: "trial_cnc_pro",
      typ: "trial",
      status: "unused",
      maxActivations: 1,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      key: "PAID-CNC-002-DEMO",
      productName: "CNC Pro License",
      priceId: "price_cnc_pro",
      typ: "paid",
      status: "unused",
      maxActivations: 3,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      key: "ENTERPRISE-CNC-003-DEMO",
      productName: "CNC Enterprise",
      priceId: "price_cnc_enterprise",
      typ: "enterprise",
      status: "unused",
      maxActivations: 10,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const license of testLicenses) {
    try {
      const response = await fetch("http://localhost:1337/api/license-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: license,
        }),
      });

      if (response.ok) {
        console.log(`   ✓ Created license: ${license.key}`);
      } else {
        const error = await response.text();
        if (error.includes("unique") || error.includes("duplicate")) {
          console.log(`   ⚠ License already exists: ${license.key}`);
        } else {
          console.error(`   ❌ Failed to create ${license.key}:`, error);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error creating ${license.key}:`, error.message);
    }
  }

  console.log("✅ License creation complete!");
}

createLicenseKeys().catch(console.error);
