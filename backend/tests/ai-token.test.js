/**
 * Tests for ai-token.js utilities
 * These test the AI token minting and verification functions
 */

const test = require("node:test");
const assert = require("node:assert/strict");

// Set up minimal env for tests (HS256 fallback)
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
process.env.JWT_ISSUER = "lightlane-test";

const {
  mintAiToken,
  verifyAiToken,
  getAiTokenTtlSeconds,
  DEFAULT_AI_TOKEN_TTL_SECONDS,
} = require("../src/utils/ai-token");

// =========================================
// Configuration Tests
// =========================================

test("DEFAULT_AI_TOKEN_TTL_SECONDS is 900 (15 minutes)", () => {
  assert.equal(DEFAULT_AI_TOKEN_TTL_SECONDS, 900);
});

test("getAiTokenTtlSeconds returns default when env not set", () => {
  delete process.env.AI_TOKEN_TTL_SECONDS;
  assert.equal(getAiTokenTtlSeconds(), 900);
});

test("getAiTokenTtlSeconds respects env override", () => {
  process.env.AI_TOKEN_TTL_SECONDS = "300";
  assert.equal(getAiTokenTtlSeconds(), 300);
  delete process.env.AI_TOKEN_TTL_SECONDS;
});

test("getAiTokenTtlSeconds ignores invalid env values", () => {
  process.env.AI_TOKEN_TTL_SECONDS = "not-a-number";
  assert.equal(getAiTokenTtlSeconds(), 900);
  delete process.env.AI_TOKEN_TTL_SECONDS;
});

// =========================================
// mintAiToken Tests
// =========================================

test("mintAiToken returns token, expiresAt, and jti", () => {
  const result = mintAiToken({ customerId: 123 });

  assert.ok(result.token, "should have token");
  assert.ok(result.expiresAt, "should have expiresAt");
  assert.ok(result.jti, "should have jti");

  // expiresAt should be a valid ISO string
  const expiresDate = new Date(result.expiresAt);
  assert.ok(!isNaN(expiresDate.getTime()), "expiresAt should be valid date");

  // jti should be a UUID
  assert.match(
    result.jti,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "jti should be UUID format"
  );
});

test("mintAiToken throws if customerId missing", () => {
  assert.throws(
    () => mintAiToken({}),
    /customerId is required/,
    "should throw for missing customerId"
  );
});

test("mintAiToken includes entitlementId in token when provided", () => {
  const result = mintAiToken({ customerId: 123, entitlementId: 456 });
  const verified = verifyAiToken(result.token);

  assert.ok(verified.valid);
  assert.equal(verified.claims.entitlementId, 456);
});

test("mintAiToken works without entitlementId", () => {
  const result = mintAiToken({ customerId: 123 });
  const verified = verifyAiToken(result.token);

  assert.ok(verified.valid);
  assert.equal(verified.claims.customerId, 123);
  assert.equal(verified.claims.entitlementId, undefined);
});

test("mintAiToken respects custom TTL", () => {
  const shortTtl = 60; // 1 minute
  const result = mintAiToken({ customerId: 123 }, shortTtl);

  const expiresDate = new Date(result.expiresAt);
  const now = new Date();
  const diffSeconds = (expiresDate - now) / 1000;

  // Should be approximately 60 seconds (allow 5 second tolerance)
  assert.ok(diffSeconds > 55 && diffSeconds <= 65, `TTL should be ~60s, got ${diffSeconds}s`);
});

// =========================================
// verifyAiToken Tests
// =========================================

test("verifyAiToken returns valid=true for valid token", () => {
  const { token } = mintAiToken({ customerId: 123, entitlementId: 456 });
  const result = verifyAiToken(token);

  assert.ok(result.valid, "should be valid");
  assert.ok(result.claims, "should have claims");
  assert.equal(result.claims.type, "ai");
  assert.equal(result.claims.customerId, 123);
  assert.equal(result.claims.entitlementId, 456);
});

test("verifyAiToken rejects missing token", () => {
  const result = verifyAiToken(null);
  assert.equal(result.valid, false);
  assert.equal(result.code, "TOKEN_MISSING");
});

test("verifyAiToken rejects empty string", () => {
  const result = verifyAiToken("");
  assert.equal(result.valid, false);
  assert.equal(result.code, "TOKEN_MISSING");
});

test("verifyAiToken rejects malformed token", () => {
  const result = verifyAiToken("not.a.valid.jwt");
  assert.equal(result.valid, false);
  assert.equal(result.code, "TOKEN_INVALID");
});

test("verifyAiToken rejects tampered token", () => {
  const { token } = mintAiToken({ customerId: 123 });
  // Tamper with the signature
  const tampered = token.slice(0, -5) + "XXXXX";
  const result = verifyAiToken(tampered);

  assert.equal(result.valid, false);
  assert.equal(result.code, "TOKEN_INVALID");
});

test("verifyAiToken rejects wrong token type", () => {
  // Create a JWT with type !== "ai" using the same secret
  const jwt = require("jsonwebtoken");
  const wrongTypeToken = jwt.sign(
    { type: "customer", customerId: 123 },
    process.env.JWT_SECRET,
    { algorithm: "HS256" }
  );

  const result = verifyAiToken(wrongTypeToken);
  assert.equal(result.valid, false);
  assert.equal(result.code, "INVALID_TOKEN_TYPE");
  assert.ok(result.error.includes("expected 'ai'"));
});

test("verifyAiToken rejects expired token", async () => {
  // Mint a token with 1 second TTL
  const { token } = mintAiToken({ customerId: 123 }, 1);

  // Wait for expiry
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const result = verifyAiToken(token);
  assert.equal(result.valid, false);
  assert.equal(result.code, "TOKEN_EXPIRED");
});

test("verifyAiToken rejects token missing customerId claim", () => {
  // Create a JWT with type=ai but no customerId
  const jwt = require("jsonwebtoken");
  const badToken = jwt.sign(
    { type: "ai" },
    process.env.JWT_SECRET,
    { algorithm: "HS256" }
  );

  const result = verifyAiToken(badToken);
  assert.equal(result.valid, false);
  assert.equal(result.code, "INVALID_TOKEN_CLAIMS");
});

// =========================================
// Round-trip Tests
// =========================================

test("mintAiToken + verifyAiToken round-trip preserves claims", () => {
  const input = { customerId: 999, entitlementId: 888 };
  const { token, jti } = mintAiToken(input);
  const result = verifyAiToken(token);

  assert.ok(result.valid);
  assert.equal(result.claims.customerId, 999);
  assert.equal(result.claims.entitlementId, 888);
  assert.equal(result.claims.jti, jti);
  assert.equal(result.claims.type, "ai");
  assert.ok(result.claims.iat, "should have iat");
  assert.ok(result.claims.exp, "should have exp");
  assert.equal(result.claims.iss, "lightlane-test");
});

// =========================================
// Token structure tests
// =========================================

test("minted token has correct subject format", () => {
  const { token } = mintAiToken({ customerId: 42 });
  const result = verifyAiToken(token);

  assert.ok(result.valid);
  assert.equal(result.claims.sub, "ai:customer:42");
});

test("different customerIds produce different tokens", () => {
  const token1 = mintAiToken({ customerId: 1 }).token;
  const token2 = mintAiToken({ customerId: 2 }).token;

  assert.notEqual(token1, token2);
});

test("same input produces different jti each time", () => {
  const result1 = mintAiToken({ customerId: 123 });
  const result2 = mintAiToken({ customerId: 123 });

  assert.notEqual(result1.jti, result2.jti);
  assert.notEqual(result1.token, result2.token);
});
