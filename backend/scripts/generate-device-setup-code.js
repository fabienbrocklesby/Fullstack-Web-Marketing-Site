#!/usr/bin/env node
/**
 * Interactive Device Setup Code Generator
 *
 * Generates a valid Device Setup Code for air-gapped device provisioning.
 * This code can be pasted into the portal UI to provision an air-gapped device.
 *
 * Usage:
 *   node scripts/generate-device-setup-code.js
 *   make airgap-setup
 *
 * The script will:
 *   1. Check for existing device identity files
 *   2. Prompt to reuse or create new identity
 *   3. Ask for optional device name and platform
 *   4. Generate/load Ed25519 keypair
 *   5. Output a Device Setup Code ready for copy/paste
 *
 * Identity files (saved for repeated use):
 *   - backend/.airgap-ui.key         - Private key PEM (0600)
 *   - backend/.airgap-ui.device.json - Device metadata
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// -----------------------------------------------------------------------------
// File paths
// -----------------------------------------------------------------------------

const KEY_FILE = path.join(__dirname, "..", ".airgap-ui.key");
const DEVICE_FILE = path.join(__dirname, "..", ".airgap-ui.device.json");

// -----------------------------------------------------------------------------
// Encoding utilities (must match backend/src/utils/offline-codes.js)
// -----------------------------------------------------------------------------

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buffer.toString("base64url");
}

function base64UrlEncodeJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return base64UrlEncode(jsonStr);
}

// -----------------------------------------------------------------------------
// Interactive prompts
// -----------------------------------------------------------------------------

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl, question, defaultValue = "") {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function promptYesNo(rl, question, defaultYes = false) {
  return new Promise((resolve) => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    rl.question(`${question} ${hint}: `, (answer) => {
      const normalized = answer.trim().toLowerCase();
      if (normalized === "") {
        resolve(defaultYes);
      } else {
        resolve(normalized === "y" || normalized === "yes");
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Key management
// -----------------------------------------------------------------------------

function existingIdentityExists() {
  return fs.existsSync(KEY_FILE) && fs.existsSync(DEVICE_FILE);
}

function loadExistingIdentity() {
  const privateKeyPem = fs.readFileSync(KEY_FILE, "utf-8");
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);
  const metadata = JSON.parse(fs.readFileSync(DEVICE_FILE, "utf-8"));
  return { privateKey, publicKey, metadata };
}

function generateNewKeypair() {
  return crypto.generateKeyPairSync("ed25519");
}

function exportPublicKeyBase64(publicKey) {
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  return publicKeyDer.toString("base64");
}

function saveIdentity(privateKey, metadata) {
  // Save private key (mode 0600)
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  fs.writeFileSync(KEY_FILE, privateKeyPem, { mode: 0o600 });

  // Save metadata
  fs.writeFileSync(DEVICE_FILE, JSON.stringify(metadata, null, 2), { mode: 0o644 });
}

// -----------------------------------------------------------------------------
// Device Setup Code builder
// -----------------------------------------------------------------------------

/**
 * Build a Device Setup Code matching backend schema:
 * {
 *   v: 1,                    // version (required)
 *   type: "device_setup",    // type (required)
 *   deviceId: string,        // device identifier (required)
 *   publicKey: string,       // base64 SPKI DER (required)
 *   createdAt: string,       // ISO timestamp (required)
 *   deviceName?: string,     // optional
 *   platform?: string,       // optional
 * }
 */
function buildDeviceSetupCode({ deviceId, publicKeyBase64, createdAt, deviceName, platform }) {
  const payload = {
    v: 1,
    type: "device_setup",
    deviceId,
    publicKey: publicKeyBase64,
    createdAt,
  };

  // Add optional fields only if provided
  if (deviceName) {
    payload.deviceName = deviceName;
  }
  if (platform) {
    payload.platform = platform;
  }

  return base64UrlEncodeJson(payload);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(70));
  console.log("  Interactive Device Setup Code Generator");
  console.log("=".repeat(70));
  console.log("");

  const rl = createInterface();

  let privateKey, publicKey, metadata;
  let isReusing = false;

  try {
    // Check for existing identity
    if (existingIdentityExists()) {
      console.log("📂 Found existing device identity:");
      const existing = loadExistingIdentity();
      console.log(`   Device ID:    ${existing.metadata.deviceId}`);
      console.log(`   Device Name:  ${existing.metadata.deviceName || "(none)"}`);
      console.log(`   Platform:     ${existing.metadata.platform || "(none)"}`);
      console.log(`   Created:      ${existing.metadata.createdAt}`);
      console.log("");

      isReusing = await promptYesNo(rl, "Use existing device identity?", true);

      if (isReusing) {
        ({ privateKey, publicKey, metadata } = existing);
        console.log("");
        console.log("✅ Reusing existing device identity.");
      }
    }

    if (!isReusing) {
      console.log("");
      console.log("🔑 Creating new device identity...");
      console.log("");

      // Prompt for device details
      const deviceId = await prompt(rl, "Device ID", crypto.randomUUID());
      const deviceName = await prompt(rl, "Device Name (optional)", "");
      const platform = await prompt(rl, "Platform (optional)", "");

      // Generate keypair
      ({ privateKey, publicKey } = generateNewKeypair());
      const publicKeyBase64 = exportPublicKeyBase64(publicKey);
      const createdAt = new Date().toISOString();

      // Build metadata
      metadata = {
        deviceId,
        publicKeyBase64,
        createdAt,
        deviceName: deviceName || undefined,
        platform: platform || undefined,
      };

      // Save identity
      saveIdentity(privateKey, metadata);
      console.log("");
      console.log("✅ New device identity created and saved.");
    }

    rl.close();

    // Build the Device Setup Code
    const deviceSetupCode = buildDeviceSetupCode({
      deviceId: metadata.deviceId,
      publicKeyBase64: metadata.publicKeyBase64,
      createdAt: metadata.createdAt,
      deviceName: metadata.deviceName,
      platform: metadata.platform,
    });

    // Output
    console.log("");
    console.log("=".repeat(70));
    console.log("  DEVICE IDENTITY");
    console.log("=".repeat(70));
    console.log("");
    console.log(`   Device ID:      ${metadata.deviceId}`);
    console.log(`   Device Name:    ${metadata.deviceName || "(none)"}`);
    console.log(`   Platform:       ${metadata.platform || "(none)"}`);
    console.log(`   Created:        ${metadata.createdAt}`);
    console.log(`   Key File:       ${KEY_FILE}`);
    console.log(`   Metadata File:  ${DEVICE_FILE}`);
    console.log("");

    console.log("=".repeat(70));
    console.log("  DEVICE SETUP CODE (copy this to portal Provision tab)");
    console.log("=".repeat(70));
    console.log("");
    console.log(deviceSetupCode);
    console.log("");

    console.log("=".repeat(70));
    console.log("  HOW TO USE");
    console.log("=".repeat(70));
    console.log("");
    console.log("1. Go to Customer Portal → Dashboard → Air-Gapped Devices");
    console.log("2. Click 'Provision Device' tab");
    console.log("3. Select your subscription entitlement from the dropdown");
    console.log("4. Paste the Device Setup Code above");
    console.log("5. Click 'Generate Activation Package'");
    console.log("6. Copy the returned Activation Package for your air-gapped device");
    console.log("");
    console.log("To generate refresh/deactivation codes after provisioning:");
    console.log("  make airgap-request-codes  (then paste the Activation Package)");
    console.log("");
    console.log("=".repeat(70));
  } catch (err) {
    rl.close();
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
