/**
 * Tests for offline-codes.js utilities
 * These test the air-gapped device activation flow codec and crypto functions
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  base64UrlEncode,
  base64UrlDecode,
  parseDeviceSetupCode,
  parseLeaseRefreshRequestCode,
  parseDeactivationCode,
  importEd25519PublicKey,
  computePublicKeyHash,
  buildLeaseRefreshSignatureMessage,
  buildDeactivationSignatureMessage,
  verifyEd25519Signature,
  buildActivationPackage,
  buildRefreshResponseCode,
} = require("../src/utils/offline-codes");

// Helper to generate test Ed25519 keypair
function generateTestKeypair() {
  return crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
}

// Helper to create a valid device setup code payload
function makeSetupPayload(overrides = {}) {
  const { publicKey: derPub } = generateTestKeypair();
  return {
    v: 1,
    type: "device_setup",
    deviceId: "test-device-123",
    deviceName: "My Test Machine",
    platform: "linux",
    publicKey: derPub.toString("base64"),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a valid lease refresh request payload
function makeRefreshPayload(overrides = {}) {
  return {
    v: 1,
    type: "lease_refresh_request",
    deviceId: "device-abc",
    entitlementId: 42,
    jti: crypto.randomUUID(),
    iat: new Date().toISOString(),
    sig: "a".repeat(64), // dummy signature
    ...overrides,
  };
}

// Helper to create a valid deactivation code payload
function makeDeactivationPayload(overrides = {}) {
  return {
    v: 1,
    type: "deactivation_code",
    deviceId: "device-xyz",
    entitlementId: 99,
    jti: crypto.randomUUID(),
    iat: new Date().toISOString(),
    sig: "b".repeat(64), // dummy signature
    ...overrides,
  };
}

// =========================================
// Base64URL Encoding/Decoding
// =========================================

test("base64UrlEncode produces URL-safe output", () => {
  const buffer = Buffer.from("hello+world/foo=bar");
  const encoded = base64UrlEncode(buffer);
  assert.ok(!encoded.includes("+"), "should not contain +");
  assert.ok(!encoded.includes("/"), "should not contain /");
  assert.ok(!encoded.includes("="), "should not contain padding");
});

test("base64UrlDecode reverses base64UrlEncode", () => {
  const original = Buffer.from("test data with special chars: +/=");
  const encoded = base64UrlEncode(original);
  const decoded = base64UrlDecode(encoded);
  assert.deepEqual(decoded, original);
});

test("base64UrlDecode handles standard base64 input", () => {
  // Standard base64 with padding
  const standardB64 = "dGVzdA=="; // "test"
  const decoded = base64UrlDecode(standardB64);
  assert.equal(decoded.toString("utf8"), "test");
});

// =========================================
// Device Setup Code Parsing
// =========================================

test("parseDeviceSetupCode extracts valid payload", () => {
  const payload = makeSetupPayload();
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, true);
  assert.equal(result.data.deviceId, payload.deviceId);
  assert.equal(result.data.publicKey, payload.publicKey);
});

test("parseDeviceSetupCode rejects missing deviceId", () => {
  const payload = makeSetupPayload();
  delete payload.deviceId;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("deviceId"));
});

test("parseDeviceSetupCode rejects missing publicKey", () => {
  const payload = makeSetupPayload();
  delete payload.publicKey;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("publicKey"));
});

test("parseDeviceSetupCode rejects malformed JSON", () => {
  // Input must be long enough to pass length check (>= 20 chars base64url)
  const encoded = base64UrlEncode(Buffer.from("not json at all this is text"));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("Invalid"));
});

test("parseDeviceSetupCode rejects wrong version", () => {
  const payload = makeSetupPayload({ v: 99 });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
});

test("parseDeviceSetupCode rejects wrong type", () => {
  const payload = makeSetupPayload({ type: "wrong_type" });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
});

test("parseDeviceSetupCode rejects oversized input", () => {
  const result = parseDeviceSetupCode("a".repeat(5000));
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("too large"));
});

// =========================================
// Lease Refresh Request Code Parsing
// =========================================

test("parseLeaseRefreshRequestCode extracts valid payload", () => {
  const payload = makeRefreshPayload();
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, true);
  assert.equal(result.data.deviceId, payload.deviceId);
  assert.equal(result.data.entitlementId, payload.entitlementId);
});

test("parseLeaseRefreshRequestCode rejects missing entitlementId", () => {
  const payload = makeRefreshPayload();
  delete payload.entitlementId;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("entitlementId"));
});

test("parseLeaseRefreshRequestCode rejects missing jti", () => {
  const payload = makeRefreshPayload();
  delete payload.jti;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("jti"));
});

test("parseLeaseRefreshRequestCode rejects missing signature", () => {
  const payload = makeRefreshPayload();
  delete payload.sig;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("sig"));
});

// =========================================
// Deactivation Code Parsing
// =========================================

test("parseDeactivationCode extracts valid payload", () => {
  const payload = makeDeactivationPayload();
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, true);
  assert.equal(result.data.deviceId, payload.deviceId);
  assert.equal(result.data.entitlementId, payload.entitlementId);
});

test("parseDeactivationCode rejects wrong type", () => {
  const payload = makeDeactivationPayload({ type: "lease_refresh_request" });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
});

// =========================================
// Ed25519 Public Key Import
// =========================================

test("importEd25519PublicKey imports valid SPKI DER key", () => {
  const { publicKey: derKey } = generateTestKeypair();
  const b64Key = derKey.toString("base64");

  const result = importEd25519PublicKey(b64Key);
  assert.equal(result.ok, true);
  assert.equal(result.publicKey.type, "public");
  assert.equal(result.publicKey.asymmetricKeyType, "ed25519");
});

test("importEd25519PublicKey rejects invalid key data", () => {
  const result = importEd25519PublicKey("notavalidkey");
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("Failed to import"));
});

test("importEd25519PublicKey rejects empty input", () => {
  const result = importEd25519PublicKey("");
  assert.equal(result.ok, false);
});

// =========================================
// Public Key Hash Computation
// =========================================

test("computePublicKeyHash produces consistent SHA256 hex", () => {
  const testKey = "MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE";
  const hash1 = computePublicKeyHash(testKey);
  const hash2 = computePublicKeyHash(testKey);

  assert.equal(hash1, hash2, "same input should produce same hash");
  assert.match(hash1, /^[a-f0-9]{64}$/, "should be 64 hex chars (SHA256)");
});

test("computePublicKeyHash produces different hashes for different keys", () => {
  const hash1 = computePublicKeyHash("key1");
  const hash2 = computePublicKeyHash("key2");
  assert.notEqual(hash1, hash2);
});

// =========================================
// Signature Message Building
// =========================================

test("buildLeaseRefreshSignatureMessage builds correct format", () => {
  const msg = buildLeaseRefreshSignatureMessage({
    deviceId: "device-123",
    entitlementId: 42,
    jti: "jti-abc",
    iat: "2024-01-01T00:00:00.000Z",
  });

  const expected = Buffer.from("LL|v1|lease_refresh_request\ndevice-123\n42\njti-abc\n2024-01-01T00:00:00.000Z");
  assert.deepEqual(msg, expected);
});

test("buildDeactivationSignatureMessage builds correct format", () => {
  const msg = buildDeactivationSignatureMessage({
    deviceId: "device-456",
    entitlementId: 99,
    jti: "jti-xyz",
    iat: "2024-01-01T00:00:00.000Z",
  });

  const expected = Buffer.from("LL|v1|deactivation_code\ndevice-456\n99\njti-xyz\n2024-01-01T00:00:00.000Z");
  assert.deepEqual(msg, expected);
});

// =========================================
// Ed25519 Signature Verification
// =========================================

test("verifyEd25519Signature accepts valid signature", () => {
  const { publicKey: derPub, privateKey: derPriv } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  const message = Buffer.from("test message to sign");
  const privKeyObj = crypto.createPrivateKey({
    key: derPriv,
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto.sign(null, message, privKeyObj);
  const b64UrlSig = base64UrlEncode(signature);

  // Import the public key first
  const keyResult = importEd25519PublicKey(b64PubKey);
  assert.equal(keyResult.ok, true);

  const result = verifyEd25519Signature(message, b64UrlSig, keyResult.publicKey);
  assert.equal(result, true);
});

test("verifyEd25519Signature rejects invalid signature", () => {
  const { publicKey: derPub } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  const message = Buffer.from("test message");
  const badSig = base64UrlEncode(Buffer.alloc(64)); // wrong signature

  const keyResult = importEd25519PublicKey(b64PubKey);
  assert.equal(keyResult.ok, true);

  const result = verifyEd25519Signature(message, badSig, keyResult.publicKey);
  assert.equal(result, false);
});

test("verifyEd25519Signature rejects tampered message", () => {
  const { publicKey: derPub, privateKey: derPriv } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  const originalMessage = Buffer.from("original message");
  const privKeyObj = crypto.createPrivateKey({
    key: derPriv,
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto.sign(null, originalMessage, privKeyObj);
  const b64UrlSig = base64UrlEncode(signature);

  const keyResult = importEd25519PublicKey(b64PubKey);
  assert.equal(keyResult.ok, true);

  // Verify with different message
  const result = verifyEd25519Signature(Buffer.from("tampered message"), b64UrlSig, keyResult.publicKey);
  assert.equal(result, false);
});

// =========================================
// Activation Package Building
// =========================================

test("buildActivationPackage produces valid structure", () => {
  const pkg = buildActivationPackage({
    activationToken: "activation-token-jwt",
    leaseToken: "lease-token-jwt",
    leaseExpiresAt: "2024-12-31T23:59:59.000Z",
  });

  // Decode and verify structure
  const decoded = JSON.parse(base64UrlDecode(pkg).toString("utf8"));

  assert.equal(decoded.v, 1);
  assert.equal(decoded.type, "activation_package");
  assert.equal(decoded.activationToken, "activation-token-jwt");
  assert.equal(decoded.leaseToken, "lease-token-jwt");
  assert.equal(decoded.leaseExpiresAt, "2024-12-31T23:59:59.000Z");
});

// =========================================
// Refresh Response Code Building
// =========================================

test("buildRefreshResponseCode produces valid structure", () => {
  const code = buildRefreshResponseCode({
    leaseToken: "new-lease-token-jwt",
    leaseExpiresAt: "2025-01-07T12:00:00.000Z",
  });

  // Decode and verify structure
  const decoded = JSON.parse(base64UrlDecode(code).toString("utf8"));

  assert.equal(decoded.v, 1);
  assert.equal(decoded.type, "lease_refresh_response");
  assert.equal(decoded.leaseToken, "new-lease-token-jwt");
  assert.equal(decoded.leaseExpiresAt, "2025-01-07T12:00:00.000Z");
});

// =========================================
// End-to-end Flow Simulation
// =========================================

test("end-to-end: setup code -> activation package round trip", () => {
  // 1. Generate device keypair (simulates desktop app)
  const { publicKey: derPub } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  // 2. Build setup code (simulates desktop app)
  const setupPayload = makeSetupPayload({ publicKey: b64PubKey });
  const setupCode = base64UrlEncode(Buffer.from(JSON.stringify(setupPayload)));

  // 3. Parse setup code (simulates backend)
  const parsed = parseDeviceSetupCode(setupCode);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deviceId, setupPayload.deviceId);
  assert.equal(parsed.data.publicKey, b64PubKey);

  // 4. Import and verify public key (simulates backend)
  const keyResult = importEd25519PublicKey(parsed.data.publicKey);
  assert.equal(keyResult.ok, true);
  assert.equal(keyResult.publicKey.asymmetricKeyType, "ed25519");

  // 5. Compute key hash for storage (simulates backend)
  const keyHash = computePublicKeyHash(parsed.data.publicKey);
  assert.match(keyHash, /^[a-f0-9]{64}$/);

  // 6. Build activation package (simulates backend)
  const activationPkg = buildActivationPackage({
    activationToken: "mock-activation-token",
    leaseToken: "mock-lease-token",
    leaseExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Verify it can be decoded
  const pkgDecoded = JSON.parse(base64UrlDecode(activationPkg).toString("utf8"));
  assert.equal(pkgDecoded.type, "activation_package");
});

test("end-to-end: lease refresh request with valid signature", () => {
  // 1. Generate device keypair
  const { publicKey: derPub, privateKey: derPriv } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  // 2. Build refresh request (simulates desktop app)
  const deviceId = "refresh-device-001";
  const entitlementId = 123;
  const jti = crypto.randomUUID();
  const iat = new Date().toISOString();

  const message = buildLeaseRefreshSignatureMessage({ deviceId, entitlementId, jti, iat });
  const privKeyObj = crypto.createPrivateKey({
    key: derPriv,
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto.sign(null, message, privKeyObj);
  const b64UrlSig = base64UrlEncode(signature);

  const requestPayload = {
    v: 1,
    type: "lease_refresh_request",
    deviceId,
    entitlementId,
    jti,
    iat,
    sig: b64UrlSig,
  };
  const requestCode = base64UrlEncode(Buffer.from(JSON.stringify(requestPayload)));

  // 3. Parse request code (simulates backend)
  const parsed = parseLeaseRefreshRequestCode(requestCode);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deviceId, deviceId);
  assert.equal(parsed.data.entitlementId, entitlementId);

  // 4. Import public key and reconstruct message for verification (simulates backend)
  const keyResult = importEd25519PublicKey(b64PubKey);
  assert.equal(keyResult.ok, true);

  const reconstructedMsg = buildLeaseRefreshSignatureMessage({
    deviceId: parsed.data.deviceId,
    entitlementId: parsed.data.entitlementId,
    jti: parsed.data.jti,
    iat: parsed.data.iat,
  });
  const isValid = verifyEd25519Signature(reconstructedMsg, parsed.data.sig, keyResult.publicKey);
  assert.equal(isValid, true);

  // 5. Build response code (simulates backend)
  const responseCode = buildRefreshResponseCode({
    leaseToken: "new-lease-token-after-refresh",
    leaseExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Verify it can be decoded
  const respDecoded = JSON.parse(base64UrlDecode(responseCode).toString("utf8"));
  assert.equal(respDecoded.type, "lease_refresh_response");
});

test("end-to-end: deactivation request with valid signature", () => {
  // 1. Generate device keypair
  const { publicKey: derPub, privateKey: derPriv } = generateTestKeypair();
  const b64PubKey = derPub.toString("base64");

  // 2. Build deactivation request (simulates desktop app)
  const deviceId = "deact-device-001";
  const entitlementId = 456;
  const jti = crypto.randomUUID();
  const iat = new Date().toISOString();

  const message = buildDeactivationSignatureMessage({ deviceId, entitlementId, jti, iat });
  const privKeyObj = crypto.createPrivateKey({
    key: derPriv,
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto.sign(null, message, privKeyObj);
  const b64UrlSig = base64UrlEncode(signature);

  const deactPayload = {
    v: 1,
    type: "deactivation_code",
    deviceId,
    entitlementId,
    jti,
    iat,
    sig: b64UrlSig,
  };
  const deactCode = base64UrlEncode(Buffer.from(JSON.stringify(deactPayload)));

  // 3. Parse deactivation code (simulates backend)
  const parsed = parseDeactivationCode(deactCode);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deviceId, deviceId);
  assert.equal(parsed.data.entitlementId, entitlementId);

  // 4. Import public key and reconstruct message for verification (simulates backend)
  const keyResult = importEd25519PublicKey(b64PubKey);
  assert.equal(keyResult.ok, true);

  const reconstructedMsg = buildDeactivationSignatureMessage({
    deviceId: parsed.data.deviceId,
    entitlementId: parsed.data.entitlementId,
    jti: parsed.data.jti,
    iat: parsed.data.iat,
  });
  const isValid = verifyEd25519Signature(reconstructedMsg, parsed.data.sig, keyResult.publicKey);
  assert.equal(isValid, true);
});
// =========================================
// Strict Base64URL Validation Tests
// =========================================

test("parseDeviceSetupCode returns INVALID_BASE64URL for empty string", () => {
  const result = parseDeviceSetupCode("");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_BASE64URL");
  assert.ok(result.error.includes("empty"));
});

test("parseDeviceSetupCode returns INVALID_BASE64URL for too short input", () => {
  const result = parseDeviceSetupCode("abc");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_BASE64URL");
  assert.ok(result.error.includes("short"));
});

test("parseDeviceSetupCode returns INVALID_BASE64URL for invalid chars", () => {
  // Contains space and special chars - must be long enough to pass length check
  const result = parseDeviceSetupCode("abcdefghij klmnopqrst+uvwxyz/123456=");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_BASE64URL");
  assert.ok(result.error.includes("invalid characters"));
});

test("parseDeviceSetupCode returns INVALID_JSON for valid base64url non-JSON", () => {
  // "not json at all" encoded in base64url
  const encoded = base64UrlEncode(Buffer.from("not json at all"));
  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_JSON");
  assert.ok(result.error.includes("not valid JSON"));
});

test("parseDeviceSetupCode returns INVALID_VERSION for wrong version", () => {
  const payload = makeSetupPayload({ v: 99 });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_VERSION");
});

test("parseDeviceSetupCode returns INVALID_TYPE for wrong type", () => {
  const payload = makeSetupPayload({ type: "wrong_type" });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_TYPE");
});

test("parseDeviceSetupCode returns INVALID_FIELDS for missing required field", () => {
  const payload = makeSetupPayload();
  delete payload.deviceId;
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseDeviceSetupCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_FIELDS");
});

test("parseDeviceSetupCode returns CODE_TOO_LARGE for oversized input", () => {
  // Generate a valid base64url string that's too long
  const oversized = "a".repeat(5000);
  const result = parseDeviceSetupCode(oversized);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "CODE_TOO_LARGE");
});

// Lease refresh validation tests
test("parseLeaseRefreshRequestCode returns INVALID_BASE64URL for invalid format", () => {
  const result = parseLeaseRefreshRequestCode("abc+def/ghi=");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_BASE64URL");
});

test("parseLeaseRefreshRequestCode returns INVALID_JSON for non-JSON", () => {
  // Must be long enough to pass length check (>= 20 chars)
  const encoded = base64UrlEncode(Buffer.from("random text that is not valid json at all"));
  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_JSON");
});

test("parseLeaseRefreshRequestCode returns INVALID_TYPE for wrong type", () => {
  const payload = makeRefreshPayload({ type: "device_setup" });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseLeaseRefreshRequestCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_TYPE");
});

// Deactivation validation tests
test("parseDeactivationCode returns INVALID_BASE64URL for invalid format", () => {
  const result = parseDeactivationCode("hello world!!!");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_BASE64URL");
});

test("parseDeactivationCode returns INVALID_JSON for non-JSON", () => {
  const encoded = base64UrlEncode(Buffer.from("<xml>not json</xml>"));
  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_JSON");
});

test("parseDeactivationCode returns INVALID_TYPE for wrong type", () => {
  const payload = makeDeactivationPayload({ type: "lease_refresh_request" });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_TYPE");
});

test("parseDeactivationCode returns INVALID_VERSION for wrong version", () => {
  const payload = makeDeactivationPayload({ v: 2 });
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_VERSION");
});

test("parseDeactivationCode returns INVALID_STRUCTURE for array input", () => {
  // Array with enough elements to produce long enough base64url output (>= 20 chars)
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_STRUCTURE");
});

test("parseDeactivationCode returns INVALID_STRUCTURE for null input", () => {
  // Pad the input so it passes base64url length check, but still decodes to null
  // We use a JSON with extra whitespace to make it longer
  const paddedNull = "null                 "; // null with spaces to make it 21 chars (valid JSON, parses to null)
  const encoded = base64UrlEncode(Buffer.from(paddedNull));
  const result = parseDeactivationCode(encoded);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_STRUCTURE");
});

// Error message sanitization test
test("error messages never leak JSON.parse details", () => {
  // Create an intentionally malformed input that would cause JSON.parse to throw
  const badJson = base64UrlEncode(Buffer.from("{invalid json"));
  
  const setupResult = parseDeviceSetupCode(badJson);
  assert.equal(setupResult.ok, false);
  assert.ok(!setupResult.error.includes("Unexpected token"), "Should not expose JSON parse error");
  assert.ok(!setupResult.error.includes("SyntaxError"), "Should not expose SyntaxError");
  
  const refreshResult = parseLeaseRefreshRequestCode(badJson);
  assert.equal(refreshResult.ok, false);
  assert.ok(!refreshResult.error.includes("Unexpected token"), "Should not expose JSON parse error");
  
  const deactResult = parseDeactivationCode(badJson);
  assert.equal(deactResult.ok, false);
  assert.ok(!deactResult.error.includes("Unexpected token"), "Should not expose JSON parse error");
});