const axios = require("axios");

const API_BASE = "http://localhost:1337/api";

const testLicenses = [
  {
    key: "TRIAL-CNC-001-DEMO",
    typ: "trial",
    status: "unused",
  },
  {
    key: "PAID-CNC-002-DEMO",
    typ: "paid",
    status: "unused",
  },
  {
    key: "ENTERPRISE-CNC-003-DEMO",
    typ: "enterprise",
    status: "unused",
  },
];

async function seedLicenses() {
  console.log("Seeding test licenses...");

  for (const license of testLicenses) {
    try {
      const response = await axios.post(`${API_BASE}/license-keys`, {
        data: license,
      });
      console.log(`✅ Created license: ${license.key}`);
    } catch (error) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.error?.message?.includes("unique")
      ) {
        console.log(`ℹ️  License already exists: ${license.key}`);
      } else {
        console.error(
          `❌ Failed to create license ${license.key}:`,
          error.response?.data || error.message,
        );
      }
    }
  }

  console.log("✅ License seeding complete!");
}

seedLicenses().catch(console.error);
