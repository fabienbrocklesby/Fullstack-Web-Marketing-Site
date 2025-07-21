#!/usr/bin/env node
/**
 * Unblock Team Members Script
 *
 * This script helps admins unblock team members who have registered.
 * Usage: node unblock-user.js <email>
 * Example: node unblock-user.js john@example.com
 */

const path = require("path");

async function unblockUser(email) {
  if (!email) {
    console.log("❌ Please provide an email address");
    console.log("Usage: node unblock-user.js <email>");
    process.exit(1);
  }

  try {
    // Change to backend directory
    const backendPath = path.join(__dirname, "backend");
    const originalDir = process.cwd();
    process.chdir(backendPath);

    // Import Strapi
    const strapi = require("@strapi/strapi");

    console.log("🔧 Initializing Strapi...");
    const app = await strapi().load();

    console.log(`🔍 Looking for user: ${email}`);

    // Find user
    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      await app.destroy();
      process.exit(1);
    }

    if (!user.blocked) {
      console.log(`✅ User ${email} is already unblocked`);
      await app.destroy();
      process.exit(0);
    }

    // Unblock user
    await strapi.entityService.update(
      "plugin::users-permissions.user",
      user.id,
      {
        data: { blocked: false },
      },
    );

    console.log(`✅ Successfully unblocked user: ${email}`);
    console.log(`📧 ${user.username} can now log in to the team portal`);

    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error unblocking user:", error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];
unblockUser(email);
