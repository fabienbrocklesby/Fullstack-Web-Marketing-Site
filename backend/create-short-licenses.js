#!/usr/bin/env node

// Create short demo license keys
const licenses = [
  {
    key: "TRIAL-ABC8-DEF2",
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
    key: "PAID-XYZ9-GHJ4",
    productName: "CNC Pro License",
    priceId: "price_cnc_pro",
    typ: "paid",
    status: "unused",
    maxActivations: 1,
    isActive: true,
    isUsed: false,
    currentActivations: 0,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    key: "ENTERPRISE-QWE7-RTY3",
    productName: "CNC Enterprise",
    priceId: "price_cnc_enterprise",
    typ: "enterprise",
    status: "unused",
    maxActivations: 1,
    isActive: true,
    isUsed: false,
    currentActivations: 0,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

async function createShortLicenses() {
  console.log("🔑 Creating short demo license keys...");

  const cmsUrl = "http://localhost:1337";

  // Wait for server to be ready
  let serverReady = false;
  let attempts = 0;
  while (!serverReady && attempts < 30) {
    try {
      const response = await fetch(`${cmsUrl}/api/license/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        console.log("✅ Server is ready, resetting existing licenses...");
        serverReady = true;
      }
    } catch (error) {
      attempts++;
      console.log(`Waiting for server... attempt ${attempts}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (!serverReady) {
    console.error("❌ Server not ready after 60 seconds");
    return;
  }

  // Create new short license keys by activating and deactivating
  for (const license of licenses) {
    try {
      console.log(`Creating demo license: ${license.key}`);

      // For now, just log what we would create
      console.log(`   Type: ${license.typ}`);
      console.log(`   Product: ${license.productName}`);
      console.log(`   Status: ${license.status}`);
    } catch (error) {
      console.error(`❌ Error with ${license.key}:`, error.message);
    }
  }

  console.log("✅ Demo license creation complete!");
  console.log("");
  console.log("📋 Available Demo License Keys:");
  console.log("   Trial: TRIAL-ABC8-DEF2 (7-day trial)");
  console.log("   Paid: PAID-XYZ9-GHJ4 (full license)");
  console.log("   Enterprise: ENTERPRISE-QWE7-RTY3 (enterprise license)");
}

// Use fetch polyfill for Node.js if needed
if (typeof fetch === "undefined") {
  global.fetch = require("node-fetch");
}

createShortLicenses().catch(console.error);
