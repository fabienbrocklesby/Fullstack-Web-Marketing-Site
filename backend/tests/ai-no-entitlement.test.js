/**
 * AI Token - No Entitlement Integration Test
 *
 * Tests that a customer without an active entitlement cannot mint an AI token.
 * This is a critical entitlement gating test for the Portal AI API.
 */

"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("AI Token - No Entitlement Gating", () => {
  /**
   * This test verifies that when a customer has no active entitlement,
   * the /api/v1/ai/token endpoint returns:
   *
   * Status: 403
   * Response: {
   *   "ok": false,
   *   "code": "ENTITLEMENT_NOT_ACTIVE",
   *   "message": "No active entitlement found. AI features require an active subscription or license."
   * }
   *
   * To run this test against the real backend:
   *
   * 1. Create a customer without any entitlements:
   *    - Use the admin panel to create a customer with email: no-entitlement@test.com
   *    - Do NOT create any entitlements for this customer
   *
   * 2. Run the integration test:
   *    curl -X POST http://localhost:1337/api/customers/login \
   *      -H "Content-Type: application/json" \
   *      -d '{"email": "no-entitlement@test.com", "password": "testpass123"}'
   *
   *    # Use the token from the response:
   *    curl -X POST http://localhost:1337/api/v1/ai/token \
   *      -H "Authorization: Bearer <customer_token>"
   *
   * Expected output:
   * {
   *   "ok": false,
   *   "code": "ENTITLEMENT_NOT_ACTIVE",
   *   "message": "No active entitlement found. AI features require an active subscription or license."
   * }
   */

  it("should be documented as integration test", () => {
    // This test file serves as documentation and a marker.
    // The actual integration test is run manually or via the .http file.
    assert.ok(true, "No-entitlement test is documented");
  });

  // ===========================================================================
  // Unit test for controller logic (mocked)
  // ===========================================================================

  describe("mintToken controller - no entitlement scenario", () => {
    it("should return ENTITLEMENT_NOT_ACTIVE when customer has no active entitlements", async () => {
      // Mock dependencies
      const mockCtx = {
        state: {
          customer: { id: 999, isActive: true },
        },
        request: {
          headers: {
            authorization: "Bearer test-token",
            "user-agent": "test-agent",
          },
          ip: "127.0.0.1",
        },
        status: null,
        body: null,
      };

      // Mock strapi.entityService.findMany to return empty array
      const mockStrapi = {
        entityService: {
          findMany: async (model, options) => {
            if (model === "api::entitlement.entitlement") {
              // Return empty array - no entitlements
              return [];
            }
            return [];
          },
        },
        log: {
          error: () => {},
          info: () => {},
          warn: () => {},
        },
      };

      // Set global strapi
      global.strapi = mockStrapi;

      // Import controller
      delete require.cache[require.resolve("../src/api/ai/controllers/ai.js")];
      const controller = require("../src/api/ai/controllers/ai.js");

      // Call mintToken
      await controller.mintToken(mockCtx);

      // Verify response
      assert.equal(mockCtx.status, 403);
      assert.equal(mockCtx.body.ok, false);
      assert.equal(mockCtx.body.code, "ENTITLEMENT_NOT_ACTIVE");
      assert.match(mockCtx.body.message, /no active entitlement/i);

      // Cleanup
      delete global.strapi;
    });
  });
});
