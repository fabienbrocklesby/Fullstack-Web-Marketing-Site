#!/usr/bin/env node

/**
 * Standalone Demo Data Seeder
 *
 * This script can be run independently to seed demo data into your Strapi backend.
 * It connects directly to the database and creates comprehensive test data.
 *
 * Usage:
 *   node demo-seeder.js
 *
 * Make sure your Strapi backend is built but not necessarily running.
 */

const path = require("path");
const fs = require("fs");

async function main() {
  console.log("🌟 Demo Data Seeder for SaaS Boilerplate");
  console.log("==========================================");

  const backendPath = path.join(__dirname, "backend");
  const buildPath = path.join(backendPath, "build");

  // Change to backend directory
  process.chdir(backendPath);

  // Set environment
  process.env.NODE_ENV = process.env.NODE_ENV || "development";

  try {
    // Check if Strapi is built
    if (!fs.existsSync(buildPath)) {
      console.log("📦 Building Strapi first...");
      const { execSync } = require("child_process");
      execSync("npm run build", { stdio: "inherit", cwd: backendPath });
    }

    console.log("🔧 Initializing Strapi...");

    // Import Strapi
    const strapi = require("@strapi/strapi");

    // Load Strapi
    const app = await strapi().load();

    console.log("✅ Strapi loaded successfully");

    // Make strapi globally available
    global.strapi = app;

    // Import the seeder
    const seeder = require("./test-data-seeder");

    console.log("🧹 Clearing existing data...");
    await seeder.clearAllData();

    console.log("🌱 Creating demo data...");
    await seeder.createTestData();

    console.log("");
    console.log("🎉 Demo setup completed successfully!");
    console.log("");
    console.log("📋 What was created:");
    console.log("   • 3 Demo customers (with login credentials)");
    console.log("   • 4 Demo affiliates (active and inactive)");
    console.log("   • 3 Demo pages (About, Terms, Privacy)");
    console.log("   • Multiple purchases with license keys");
    console.log("   • Realistic device activations and usage data");
    console.log("");
    console.log("🔑 Demo Credentials:");
    console.log("   Customer Login: customer1@example.com / password123");
    console.log("   Customer Login: customer2@example.com / password123");
    console.log("   Customer Login: customer3@example.com / password123");
    console.log("");
    console.log("🌐 Access Points:");
    console.log("   • Strapi Admin: http://localhost:1337/admin");
    console.log("   • Frontend: http://localhost:4321");
    console.log(
      "   • Customer Dashboard: http://localhost:4321/customer/login",
    );
    console.log("");
    console.log("💡 Next Steps:");
    console.log(
      "   1. Create a Strapi admin user: cd backend && npm run strapi admin:create-user",
    );
    console.log("   2. Start the application: pnpm dev");
    console.log(
      "   3. Login to the customer dashboard with the demo credentials above",
    );

    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Demo seeding failed:", error);
    console.error("");
    console.error("🔧 Troubleshooting:");
    console.error("   1. Make sure you're in the project root directory");
    console.error("   2. Run: pnpm install");
    console.error("   3. Make sure no other Strapi instance is running");
    console.error("   4. Try: rm -rf backend/.tmp backend/build backend/dist");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
