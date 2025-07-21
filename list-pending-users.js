#!/usr/bin/env node
/**
 * List Team Registration Requests
 *
 * This script shows all blocked users awaiting approval.
 * Usage: node list-pending-users.js
 */

const path = require("path");

async function listPendingUsers() {
  try {
    // Change to backend directory
    const backendPath = path.join(__dirname, "backend");
    process.chdir(backendPath);

    // Import Strapi
    const strapi = require("@strapi/strapi");

    console.log("🔧 Initializing Strapi...");
    const app = await strapi().load();

    console.log("🔍 Finding pending user registrations...");

    // Find all blocked users
    const blockedUsers = await strapi
      .query("plugin::users-permissions.user")
      .findMany({
        where: { blocked: true },
        populate: ["role"],
      });

    if (blockedUsers.length === 0) {
      console.log("✅ No pending user registrations");
      await app.destroy();
      process.exit(0);
    }

    console.log(`📋 Found ${blockedUsers.length} pending registration(s):`);
    console.log("");

    blockedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role?.name || "No role"}`);
      console.log(
        `   Created: ${new Date(user.createdAt).toLocaleDateString()}`,
      );
      console.log("");
    });

    console.log("💡 To unblock a user, run:");
    console.log("   node unblock-user.js <email>");
    console.log("");
    console.log("💡 Or unblock via Strapi Admin:");
    console.log(
      "   http://localhost:1337/admin/content-manager/collectionType/plugin::users-permissions.user",
    );

    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error listing users:", error.message);
    process.exit(1);
  }
}

listPendingUsers();
