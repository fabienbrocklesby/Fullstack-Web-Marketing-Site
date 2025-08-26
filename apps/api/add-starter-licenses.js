#!/usr/bin/env node

// Add starter license types that match the pricing tiers

async function addStarterLicenses() {
  console.log("🔑 Adding starter license types...");

  const cmsUrl = "http://localhost:1337";

  // Test licenses that match the pricing structure
  const testLicenses = [
    {
      key: "STARTER-ABC8-DEF2",
      productName: "Starter Plan",
      priceId: "price_starter",
      typ: "starter",
      status: "unused",
      maxActivations: 1,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      key: "PRO-XYZ9-GHJ4",
      productName: "Pro Plan",
      priceId: "price_pro",
      typ: "pro",
      status: "unused",
      maxActivations: 1,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      key: "ENTERPRISE-QWE7-RTY3",
      productName: "Enterprise Plan",
      priceId: "price_enterprise",
      typ: "enterprise",
      status: "unused",
      maxActivations: 1,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      key: "TRIAL-TRL1-TEST",
      productName: "Trial License",
      priceId: "trial_license",
      typ: "trial",
      status: "unused",
      maxActivations: 1,
      isActive: true,
      isUsed: false,
      currentActivations: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days for trial
    },
  ];

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
        console.log("✅ Server is ready");
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

  console.log("✅ License types added!");
  console.log("");
  console.log("📋 Available Demo License Keys:");
  console.log("   Trial: TRIAL-TRL1-TEST (7-day trial)");
  console.log("   Starter: STARTER-ABC8-DEF2 (starter plan)");
  console.log("   Pro: PRO-XYZ9-GHJ4 (pro plan)");
  console.log("   Enterprise: ENTERPRISE-QWE7-RTY3 (enterprise plan)");
}

// Use fetch polyfill for Node.js if needed
if (typeof fetch === "undefined") {
  global.fetch = require("node-fetch");
}

addStarterLicenses().catch(console.error);
