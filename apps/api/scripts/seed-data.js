#!/usr/bin/env node

// Standalone script to seed data into Strapi
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

async function runSeeder() {
  console.log("🌱 Starting data seeding process...");

  try {
    // Check if Strapi is built
    const buildPath = path.join(__dirname, "..", "build");
    if (!fs.existsSync(buildPath)) {
      console.log("📦 Building Strapi...");
      execSync("npm run build", {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
      });
    }

    // Create a temporary script to run inside Strapi context
    const tempScript = `
const seeder = require('./test-data-seeder');

module.exports = async () => {
  try {
    await seeder.clearAllData();
    await seeder.createTestData();
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};
`;

    const tempFile = path.join(__dirname, "..", "temp-seed.js");
    fs.writeFileSync(tempFile, tempScript);

    console.log("🚀 Running seeder with Strapi context...");

    // Execute the seeder
    execSync(`npx strapi console --file temp-seed.js`, {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });

    // Clean up
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  } catch (error) {
    console.error("❌ Seeding process failed:", error.message);
    process.exit(1);
  }
}

// Alternative method using direct database connection
async function runSeederDirect() {
  console.log("🌱 Starting direct database seeding...");

  const strapiPath = path.join(__dirname, "..");
  process.chdir(strapiPath);

  // Set environment variables
  process.env.NODE_ENV = process.env.NODE_ENV || "development";

  try {
    // Import Strapi
    const strapi = require("@strapi/strapi");

    console.log("🔧 Initializing Strapi...");
    const app = await strapi().load();

    // Import and run seeder
    const seeder = require("../test-data-seeder");

    // Make strapi globally available for the seeder
    global.strapi = app;

    await seeder.clearAllData();
    await seeder.createTestData();

    console.log("🎉 Seeding completed successfully!");
    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Direct seeding failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  // Try direct method first, fallback to console method
  runSeederDirect().catch(() => {
    console.log("🔄 Falling back to console method...");
    runSeeder();
  });
}

module.exports = { runSeeder, runSeederDirect };
