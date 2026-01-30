#!/usr/bin/env node
/**
 * Interactive Request Code Generator
 *
 * Generates valid Lease Refresh Request and Deactivation codes for air-gapped
 * devices that have already been provisioned.
 *
 * This script:
 *   1. Prompts for an Activation Package (paste or file path)
 *   2. Extracts deviceId + entitlementId from the embedded lease token
 *   3. Validates that deviceId matches the persisted device identity
 *   4. Generates signed refresh and deactivation codes using the persisted private key
 *
 * Usage:
 *   node scripts/generate-request-codes.js
 *   make airgap-request-codes
 *
 * Prerequisites:
 *   - Run `make airgap-setup` first to create device identity
 *   - Provision the device in the portal UI and download the activation package
 *
 * Identity files (must exist from airgap-setup):
 *   - backend/.airgap-ui.key         - Private key PEM
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

function base64UrlDecode(str) {
  return Buffer.from(str, "base64url");
}

function base64UrlDecodeJson(str) {
  const decoded = base64UrlDecode(str).toString("utf-8");
  return JSON.parse(decoded);
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

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// -----------------------------------------------------------------------------
// Identity management
// -----------------------------------------------------------------------------

function identityExists() {
  return fs.existsSync(KEY_FILE) && fs.existsSync(DEVICE_FILE);
}

function loadIdentity() {
  const privateKeyPem = fs.readFileSync(KEY_FILE, "utf-8");
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const metadata = JSON.parse(fs.readFileSync(DEVICE_FILE, "utf-8"));
  return { privateKey, metadata };
}

// -----------------------------------------------------------------------------
// Activation Package parsing
// -----------------------------------------------------------------------------

/**
 * Load activation package from file or direct paste.
 * Supports:
 *   - Direct base64url string
 *   - JSON file with { value: "<code>" } format (portal download format)
 *   - JSON file with { activationPackage: "<code>" } format
 *   - Plain text file with base64url string
 */
function loadActivationPackage(input) {
  let code = input;

  // Check if input is a file path
  if (fs.existsSync(input)) {
    console.log(`📂 Loading from file: ${input}`);
    const content = fs.readFileSync(input, "utf-8").trim();

    // Try parsing as JSON
    try {
      const json = JSON.parse(content);
      if (json.value && typeof json.value === "string") {
        code = json.value.trim();
        console.log("   Extracted 'value' field from JSON");
      } else if (json.activationPackage && typeof json.activationPackage === "string") {
        code = json.activationPackage.trim();
        console.log("   Extracted 'activationPackage' field from JSON");
      } else {
        // JSON but no known field, treat as error
        throw new Error("JSON file doesn't contain 'value' or 'activationPackage' field");
      }
    } catch (e) {
      // Not JSON, treat as plain text
      code = content.replace(/\r\n/g, "\n").replace(/\n/g, "").trim();
      console.log("   Loaded as plain text file");
    }
  }

  // Validate base64url format
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error("Invalid activation package format - must be base64url encoded");
  }

  return code;
}

/**
 * Decode activation package and extract lease token claims.
 * Returns { deviceId, entitlementId }
 */
function parseActivationPackage(code) {
  // Decode outer activation package
  const pkg = base64UrlDecodeJson(code);

  if (pkg.type !== "activation_package") {
    throw new Error(`Expected type 'activation_package', got '${pkg.type}'`);
  }

  if (!pkg.leaseToken) {
    throw new Error("Activation package missing leaseToken field");
  }

  // Decode JWT payload (we just want claims, not verifying signature)
  const jwtParts = pkg.leaseToken.split(".");
  if (jwtParts.length !== 3) {
    throw new Error("Invalid lease token format - expected JWT");
  }

  const payload = JSON.parse(Buffer.from(jwtParts[1], "base64url").toString("utf-8"));

  if (!payload.deviceId) {
    throw new Error("Lease token missing deviceId claim");
  }

  if (!payload.entitlementId && payload.entitlementId !== 0) {
    throw new Error("Lease token missing entitlementId claim");
  }

  return {
    deviceId: payload.deviceId,
    entitlementId: payload.entitlementId,
    customerId: payload.customerId,
    tier: payload.tier,
    leaseExpiresAt: pkg.leaseExpiresAt,
  };
}

// -----------------------------------------------------------------------------
// Signature helpers (MUST match backend exactly)
// -----------------------------------------------------------------------------

/**
 * Build signature message for lease refresh request.
 * Format: "LL|v1|lease_refresh_request\n<deviceId>\n<entitlementId>\n<jti>\n<iat>"
 */
function buildLeaseRefreshSignatureMessage({ deviceId, entitlementId, jti, iat }) {
  return Buffer.from(
    `LL|v1|lease_refresh_request\n${deviceId}\n${entitlementId}\n${jti}\n${iat}`,
    "utf-8"
  );
}

/**
 * Build signature message for deactivation code.
 * Format: "LL|v1|deactivation_code\n<deviceId>\n<entitlementId>\n<jti>\n<iat>"
 */
function buildDeactivationSignatureMessage({ deviceId, entitlementId, jti, iat }) {
  return Buffer.from(
    `LL|v1|deactivation_code\n${deviceId}\n${entitlementId}\n${jti}\n${iat}`,
    "utf-8"
  );
}

/**
 * Sign a message with an Ed25519 private key.
 */
function sign(message, privateKey) {
  const signature = crypto.sign(null, message, privateKey);
  return base64UrlEncode(signature);
}

// -----------------------------------------------------------------------------
// Code generators
// -----------------------------------------------------------------------------

/**
 * Generate a Lease Refresh Request Code.
 * Schema: { v, type, deviceId, entitlementId, jti, iat, sig }
 */
function generateLeaseRefreshRequestCode({ deviceId, entitlementId, privateKey }) {
  const jti = crypto.randomUUID();
  const iat = new Date().toISOString();

  const message = buildLeaseRefreshSignatureMessage({ deviceId, entitlementId, jti, iat });
  const sig = sign(message, privateKey);

  const payload = {
    v: 1,
    type: "lease_refresh_request",
    deviceId,
    entitlementId,
    jti,
    iat,
    sig,
  };

  return base64UrlEncodeJson(payload);
}

/**
 * Generate a Deactivation Code.
 * Schema: { v, type, deviceId, entitlementId, jti, iat, sig }
 */
function generateDeactivationCode({ deviceId, entitlementId, privateKey }) {
  const jti = crypto.randomUUID();
  const iat = new Date().toISOString();

  const message = buildDeactivationSignatureMessage({ deviceId, entitlementId, jti, iat });
  const sig = sign(message, privateKey);

  const payload = {
    v: 1,
    type: "deactivation_code",
    deviceId,
    entitlementId,
    jti,
    iat,
    sig,
  };

  return base64UrlEncodeJson(payload);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║         Air-Gapped Request Code Generator                     ║");
  console.log("║  Generates refresh + deactivation codes from activation pkg   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Check for existing identity
  if (!identityExists()) {
    console.error("❌ Error: No device identity found.");
    console.error("");
    console.error("   Run 'make airgap-setup' first to create a device identity,");
    console.error("   then provision that device in the portal UI.");
    console.error("");
    console.error("   Expected files:");
    console.error(`     - ${KEY_FILE}`);
    console.error(`     - ${DEVICE_FILE}`);
    process.exit(1);
  }

  // Load persisted identity
  const { privateKey, metadata } = loadIdentity();
  console.log("📂 Loaded device identity:");
  console.log(`   Device ID:    ${metadata.deviceId}`);
  console.log(`   Device Name:  ${metadata.deviceName || "(none)"}`);
  console.log(`   Platform:     ${metadata.platform || "(none)"}`);
  console.log("");

  const rl = createInterface();

  try {
    // Prompt for activation package
    console.log("Paste the Activation Package code below, or enter a file path.");
    console.log("(The activation package is what the portal returned after provisioning)");
    console.log("");
    const input = await prompt(rl, "Activation Package (paste or file path): ");

    if (!input) {
      console.error("❌ Error: No input provided.");
      process.exit(1);
    }

    console.log("");

    // Load and parse activation package
    const code = loadActivationPackage(input);
    const claims = parseActivationPackage(code);

    console.log("");
    console.log("📋 Extracted from activation package:");
    console.log(`   Device ID:       ${claims.deviceId}`);
    console.log(`   Entitlement ID:  ${claims.entitlementId}`);
    console.log(`   Customer ID:     ${claims.customerId || "(none)"}`);
    console.log(`   Tier:            ${claims.tier || "(none)"}`);
    console.log(`   Lease Expires:   ${claims.leaseExpiresAt || "(unknown)"}`);
    console.log("");

    // Validate device ID matches
    if (claims.deviceId !== metadata.deviceId) {
      console.error("❌ Error: Device ID mismatch!");
      console.error("");
      console.error(`   Persisted device ID:  ${metadata.deviceId}`);
      console.error(`   Package device ID:    ${claims.deviceId}`);
      console.error("");
      console.error("   The activation package was provisioned for a different device.");
      console.error("   Either:");
      console.error("     1. Use the correct activation package for this device, OR");
      console.error("     2. Run 'make airgap-setup' to create a new device identity");
      console.error("        and re-provision in the portal.");
      process.exit(1);
    }

    console.log("✅ Device ID matches persisted identity.");
    console.log("");

    // Generate codes
    const refreshCode = generateLeaseRefreshRequestCode({
      deviceId: claims.deviceId,
      entitlementId: claims.entitlementId,
      privateKey,
    });

    const deactivationCode = generateDeactivationCode({
      deviceId: claims.deviceId,
      entitlementId: claims.entitlementId,
      privateKey,
    });

    // Output
    console.log("═".repeat(67));
    console.log("  GENERATED REQUEST CODES");
    console.log("═".repeat(67));
    console.log("");

    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  1. LEASE REFRESH REQUEST CODE (use in Refresh tab)            │");
    console.log("├─────────────────────────────────────────────────────────────────┤");
    console.log("");
    console.log(refreshCode);
    console.log("");
    console.log("└─────────────────────────────────────────────────────────────────┘");
    console.log("");

    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  2. DEACTIVATION CODE (use in Deactivate tab)                  │");
    console.log("├─────────────────────────────────────────────────────────────────┤");
    console.log("");
    console.log(deactivationCode);
    console.log("");
    console.log("└─────────────────────────────────────────────────────────────────┘");
    console.log("");

    console.log("═".repeat(67));
    console.log("  HOW TO USE");
    console.log("═".repeat(67));
    console.log("");
    console.log("1. REFRESH (every 7 days for subscriptions):");
    console.log("   - Go to Portal → Air-Gapped → Refresh Lease tab");
    console.log("   - Paste the LEASE REFRESH REQUEST CODE above");
    console.log("   - Download or copy the response back to the air-gapped machine");
    console.log("");
    console.log("2. DEACTIVATE (when moving to a new machine):");
    console.log("   - Go to Portal → Air-Gapped → Deactivate tab");
    console.log("   - Paste the DEACTIVATION CODE above");
    console.log("   - The device slot will be freed for re-use");
    console.log("");
    console.log("⚠️  Each code can only be used ONCE (replay protection).");
    console.log("   Run this script again to generate new codes.");
    console.log("");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("");
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
