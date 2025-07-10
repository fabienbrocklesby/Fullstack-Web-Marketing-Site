#!/usr/bin/env node

// Create proper starter/pro/enterprise license keys that match the pricing tiers
async function createProperLicenses() {
  console.log("🔑 Adding proper license types...");

  const baseUrl = "http://localhost:1337/api";

  // First, let's create license keys that match what users would expect
  const testLicenses = [
    {
      key: "STARTER-ABC8-DEF2",
      productName: "Starter Plan",
      priceId: "price_starter",
      typ: "starter",
      status: "unused",
    },
    {
      key: "PRO-XYZ9-GHJ4",
      productName: "Pro Plan",
      priceId: "price_pro",
      typ: "pro",
      status: "unused",
    },
    {
      key: "ENTERPRISE-QWE7-RTY3",
      productName: "Enterprise Plan",
      priceId: "price_enterprise",
      typ: "enterprise",
      status: "unused",
    },
    {
      key: "TRIAL-TRL1-TEST",
      productName: "Trial License",
      priceId: "trial_license",
      typ: "trial",
      status: "unused",
    },
  ];

  console.log("Testing with a starter license activation...");

  // Test activation with one of our licenses
  try {
    const activateResponse = await fetch(`${baseUrl}/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenceKey: "STARTER-ABC8-DEF2",
        machineId: "TEST-MACHINE-001",
      }),
    });

    const result = await activateResponse.json();

    if (activateResponse.ok && result.jwt) {
      console.log("✅ Activation successful!");
      console.log("   New License Key:", result.licenseKey);
      console.log(
        "   Type should be STARTER, actual prefix:",
        result.licenseKey.split("-")[0],
      );

      // Decode the JWT to verify the typ field
      const payload = JSON.parse(atob(result.jwt.split(".")[1]));
      console.log("   JWT typ field:", payload.typ);
    } else {
      console.log("❌ Activation failed:", result.error || result.message);
    }
  } catch (error) {
    console.error("❌ Error testing activation:", error.message);
  }
}

// Use fetch polyfill for Node.js if needed
if (typeof fetch === "undefined") {
  global.fetch = require("node-fetch");
}

createProperLicenses().catch(console.error);
