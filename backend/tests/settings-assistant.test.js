/**
 * Settings Assistant Service Tests
 *
 * Tests for validation, error mapping, and OpenAI integration.
 * Uses mocked fetch to test provider error scenarios.
 */

"use strict";

const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

// Store original env and fetch
const originalEnv = { ...process.env };
let originalFetch;

// Mock fetch for OpenAI tests
function createMockFetch(responses) {
  let callIndex = 0;
  return async (url, options) => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json,
      text: async () => response.text || "",
    };
  };
}

describe("Settings Assistant Service", () => {
  let service;

  beforeEach(() => {
    // Reset env vars
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.AI_OPENAI_MODEL = "gpt-4o-mini";
    process.env.AI_OPENAI_TIMEOUT_MS = "5000";
    process.env.AI_SETTINGS_MAX_PROMPT_CHARS = "2000";
    process.env.AI_SETTINGS_MAX_CONTEXT_KEYS = "10";
    process.env.AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS = "200";

    // Fresh require to pick up env changes
    delete require.cache[require.resolve("../src/api/ai/services/settings-assistant.js")];
    service = require("../src/api/ai/services/settings-assistant.js");

    // Store original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore env
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);

    // Restore fetch
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // Validation Tests
  // ===========================================================================

  describe("validatePayload", () => {
    it("should accept valid minimal payload", () => {
      const result = service.validatePayload({ prompt: "How do I enable dark mode?" });
      assert.equal(result.valid, true);
    });

    it("should accept valid payload with context", () => {
      const result = service.validatePayload({
        prompt: "How do I enable dark mode?",
        context: {
          currentSettings: {
            theme: "light",
            language: "en",
          },
        },
      });
      assert.equal(result.valid, true);
    });

    it("should reject missing prompt", () => {
      const result = service.validatePayload({});
      assert.equal(result.valid, false);
      assert.match(result.error, /prompt.*required/i);
    });

    it("should reject empty prompt", () => {
      const result = service.validatePayload({ prompt: "   " });
      assert.equal(result.valid, false);
      assert.match(result.error, /empty/i);
    });

    it("should reject prompt exceeding max length", () => {
      const longPrompt = "a".repeat(2001);
      const result = service.validatePayload({ prompt: longPrompt });
      assert.equal(result.valid, false);
      assert.match(result.error, /exceeds maximum length/i);
      assert.equal(result.details.field, "prompt");
      assert.equal(result.details.maxLength, 2000);
    });

    it("should reject non-object context", () => {
      const result = service.validatePayload({
        prompt: "test",
        context: "not an object",
      });
      assert.equal(result.valid, false);
      assert.match(result.error, /context.*object/i);
    });

    it("should reject too many context keys", () => {
      const settings = {};
      for (let i = 0; i < 11; i++) {
        settings[`key${i}`] = "value";
      }
      const result = service.validatePayload({
        prompt: "test",
        context: { currentSettings: settings },
      });
      assert.equal(result.valid, false);
      assert.match(result.error, /exceeds maximum.*keys/i);
    });

    it("should reject context value exceeding max length", () => {
      const result = service.validatePayload({
        prompt: "test",
        context: {
          currentSettings: {
            longValue: "x".repeat(201),
          },
        },
      });
      assert.equal(result.valid, false);
      assert.match(result.error, /exceeds maximum length/i);
    });

    it("should accept context values at max length", () => {
      const result = service.validatePayload({
        prompt: "test",
        context: {
          currentSettings: {
            maxValue: "x".repeat(200),
          },
        },
      });
      assert.equal(result.valid, true);
    });
  });

  // ===========================================================================
  // buildUserMessage Tests
  // ===========================================================================

  describe("buildUserMessage", () => {
    it("should return prompt only when no context", () => {
      const message = service.buildUserMessage("How do I enable dark mode?", null);
      assert.equal(message, "How do I enable dark mode?");
    });

    it("should trim prompt", () => {
      const message = service.buildUserMessage("  test prompt  ", null);
      assert.equal(message, "test prompt");
    });

    it("should append currentSettings when provided", () => {
      const message = service.buildUserMessage("test", {
        currentSettings: { theme: "light", lang: "en" },
      });
      assert.match(message, /test/);
      assert.match(message, /Current settings:/);
      assert.match(message, /theme: light/);
      assert.match(message, /lang: en/);
    });

    it("should not append settings section when currentSettings is empty", () => {
      const message = service.buildUserMessage("test", {
        currentSettings: {},
      });
      assert.equal(message, "test");
    });
  });

  // ===========================================================================
  // getConfig Tests
  // ===========================================================================

  describe("getConfig", () => {
    it("should return configured values", () => {
      const config = service.getConfig();
      assert.equal(config.apiKey, "sk-test-key");
      assert.equal(config.model, "gpt-4o-mini");
      assert.equal(config.timeoutMs, 5000);
      assert.equal(config.maxPromptChars, 2000);
    });

    it("should use defaults when env vars not set", () => {
      delete process.env.AI_OPENAI_MODEL;
      delete process.env.AI_OPENAI_TIMEOUT_MS;

      // Fresh require
      delete require.cache[require.resolve("../src/api/ai/services/settings-assistant.js")];
      const freshService = require("../src/api/ai/services/settings-assistant.js");

      const config = freshService.getConfig();
      assert.equal(config.model, "gpt-4o-mini"); // default
      assert.equal(config.timeoutMs, 15000); // default
    });
  });

  // ===========================================================================
  // callOpenAI Tests (mocked)
  // ===========================================================================

  describe("callOpenAI", () => {
    it("should return error when API key is not configured", async () => {
      delete process.env.OPENAI_API_KEY;

      // Fresh require
      delete require.cache[require.resolve("../src/api/ai/services/settings-assistant.js")];
      const freshService = require("../src/api/ai/services/settings-assistant.js");

      const result = await freshService.callOpenAI("test prompt", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "INTERNAL_ERROR");
      assert.equal(result.error.status, 500);
    });

    it("should return success with response data on valid OpenAI response", async () => {
      global.fetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: {
            choices: [
              {
                message: {
                  content: "To enable dark mode, go to Settings > Appearance.",
                },
              },
            ],
          },
        },
      ]);

      const result = await service.callOpenAI("How to enable dark mode?", null);
      assert.equal(result.success, true);
      assert.equal(result.data.response, "To enable dark mode, go to Settings > Appearance.");
      assert.equal(result.data.model, "gpt-4o-mini");
      assert.ok(typeof result.latencyMs === "number");
    });

    it("should map 429 to PROVIDER_RATE_LIMITED", async () => {
      global.fetch = createMockFetch([
        {
          ok: false,
          status: 429,
          text: "Rate limit exceeded",
        },
      ]);

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_RATE_LIMITED");
      assert.equal(result.error.status, 429);
    });

    it("should map 401 to INTERNAL_ERROR (server misconfig)", async () => {
      global.fetch = createMockFetch([
        {
          ok: false,
          status: 401,
          text: "Invalid API key",
        },
      ]);

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "INTERNAL_ERROR");
      assert.equal(result.error.status, 500);
    });

    it("should map 500 to PROVIDER_ERROR", async () => {
      global.fetch = createMockFetch([
        {
          ok: false,
          status: 500,
          text: "Internal server error",
        },
      ]);

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_ERROR");
      assert.equal(result.error.status, 502);
    });

    it("should handle timeout (AbortError)", async () => {
      // Mock fetch to throw AbortError
      global.fetch = async () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      };

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_TIMEOUT");
      assert.equal(result.error.status, 504);
    });

    it("should handle network errors", async () => {
      global.fetch = async () => {
        throw new Error("Network error");
      };

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_ERROR");
      assert.equal(result.error.status, 502);
    });

    it("should handle invalid response structure", async () => {
      global.fetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: { unexpected: "format" },
        },
      ]);

      const result = await service.callOpenAI("test", null);
      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_ERROR");
      assert.equal(result.error.status, 502);
    });
  });

  // ===========================================================================
  // mapProviderError Tests
  // ===========================================================================

  describe("mapProviderError", () => {
    it("should map 400 to VALIDATION_ERROR", () => {
      const result = service.mapProviderError(400, "Bad request", 100);
      assert.equal(result.error.code, "VALIDATION_ERROR");
      assert.equal(result.error.status, 400);
    });

    it("should map 403 to INTERNAL_ERROR", () => {
      const result = service.mapProviderError(403, "Forbidden", 100);
      assert.equal(result.error.code, "INTERNAL_ERROR");
      assert.equal(result.error.status, 500);
    });

    it("should map 502 to PROVIDER_ERROR", () => {
      const result = service.mapProviderError(502, "Bad gateway", 100);
      assert.equal(result.error.code, "PROVIDER_ERROR");
      assert.equal(result.error.status, 502);
    });

    it("should map unknown status to PROVIDER_ERROR", () => {
      const result = service.mapProviderError(418, "I'm a teapot", 100);
      assert.equal(result.error.code, "PROVIDER_ERROR");
      assert.equal(result.error.status, 502);
    });
  });
});
