#!/usr/bin/env node
/**
 * Generate test vectors for air-gapped code manual e2e testing.
 * Run this script, then copy the codes to the portal UI to verify.
 */

const { base64UrlEncode } = require("../src/utils/offline-codes.js");
const crypto = require("crypto");

function createCode(data) {
  return base64UrlEncode(Buffer.from(JSON.stringify(data)));
}

console.log("=== Air-Gapped Code Test Vectors ===\n");

// Invalid codes for testing error handling
console.log("1. Empty string (copy this to test):");
console.log("   (just leave field empty)\n");

console.log("2. Too short code:");
console.log("   abc123\n");

console.log("3. Invalid characters (contains space):");
console.log("   abcdefghij klmnopqrst\n");

console.log("4. Valid base64url but not JSON:");
console.log("   " + base64UrlEncode(Buffer.from("this is not valid json data at all")) + "\n");

console.log("5. Wrong version:");
const wrongVersion = createCode({ v: 99, type: "device_setup", deviceId: "test", publicKey: "abc123", createdAt: new Date().toISOString() });
console.log("   " + wrongVersion + "\n");

console.log("6. Wrong type for provision:");
const wrongType = createCode({ v: 1, type: "wrong_type", deviceId: "test", publicKey: "abc123", createdAt: new Date().toISOString() });
console.log("   " + wrongType + "\n");

console.log("7. Missing required field (no deviceId):");
const missingField = createCode({ v: 1, type: "device_setup", publicKey: "abc123", createdAt: new Date().toISOString() });
console.log("   " + missingField + "\n");

// Valid device setup code
const { publicKey } = crypto.generateKeyPairSync("ed25519");
const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
const publicKeyB64 = publicKeyDer.toString("base64");

const validSetup = createCode({
  v: 1,
  type: "device_setup",
  deviceId: "test-device-" + Date.now(),
  deviceName: "Test Device",
  platform: "macOS",
  publicKey: publicKeyB64,
  createdAt: new Date().toISOString()
});
console.log("8. VALID device setup code (for full e2e test):");
console.log("   " + validSetup + "\n");

console.log("Copy these codes to the portal UI to verify error messages are user-friendly.");
