/**
 * Engrave Assistant Service Tests
 *
 * Tests for validation, error mapping, and OpenAI integration.
 * Uses mocked fetch to test provider error scenarios.
 */

"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const originalEnv = { ...process.env };
let originalFetch;

function createMockFetch(responses) {
  let callIndex = 0;
  return async () => {
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

function createTempImage() {
  const tmpPath = path.join(os.tmpdir(), `engrave-test-${Date.now()}.png`);
  fs.writeFileSync(tmpPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return tmpPath;
}

function buildValidPayload() {
  return {
    prompt: "Make the engraving crisp with clean edges.",
    context: {
      material: "birch plywood",
      device: "LightLane Pro",
    },
    availableSettings: {
      power: { type: "number", minimum: 0, maximum: 100 },
      speed: { type: "number", minimum: 1, maximum: 300 },
      passes: { type: "integer", minimum: 1, maximum: 10 },
      dither: { type: "boolean" },
      mode: { type: "string", enum: ["raster", "vector"] },
    },
  };
}

function buildImageFile(tmpPath) {
  const size = fs.statSync(tmpPath).size;
  return {
    path: tmpPath,
    size,
    type: "image/png",
    name: path.basename(tmpPath),
  };
}

describe("Engrave Assistant Service", () => {
  let service;
  let tempImagePath;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.AI_OPENAI_MODEL = "gpt-4o-mini";
    process.env.AI_OPENAI_TIMEOUT_MS = "5000";
    process.env.AI_ENGRAVE_MAX_PROMPT_CHARS = "2000";
    process.env.AI_ENGRAVE_MAX_CONTEXT_CHARS = "4000";
    process.env.AI_ENGRAVE_MAX_SETTINGS_KEYS = "50";
    process.env.AI_ENGRAVE_MAX_SETTINGS_SCHEMA_CHARS = "10000";
    process.env.AI_ENGRAVE_MAX_IMAGE_BYTES = "20";

    delete require.cache[require.resolve("../src/api/ai/services/engrave-assistant.js")];
    service = require("../src/api/ai/services/engrave-assistant.js");

    originalFetch = global.fetch;
    tempImagePath = createTempImage();
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);

    global.fetch = originalFetch;

    if (tempImagePath && fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
  });

  describe("validateRequest", () => {
    it("should reject missing image", () => {
      const payload = buildValidPayload();
      const result = service.validateRequest(payload, null);
      assert.equal(result.valid, false);
      assert.match(result.error, /image.*required/i);
    });

    it("should reject oversized image", () => {
      const payload = buildValidPayload();
      const imageFile = buildImageFile(tempImagePath);
      const result = service.validateRequest(payload, { ...imageFile, size: 21 });
      assert.equal(result.valid, false);
      assert.match(result.error, /exceeds maximum size/i);
    });

    it("should reject invalid availableSettings schema", () => {
      const payload = buildValidPayload();
      payload.availableSettings = { power: { minimum: 0, maximum: 100 } };
      const imageFile = buildImageFile(tempImagePath);
      const result = service.validateRequest(payload, imageFile);
      assert.equal(result.valid, false);
      assert.match(result.error, /type is required/i);
    });
  });

  describe("callOpenAI", () => {
    it("should map 429 to PROVIDER_RATE_LIMITED", async () => {
      global.fetch = createMockFetch([
        {
          ok: false,
          status: 429,
          text: "Rate limit",
        },
      ]);

      const payload = buildValidPayload();
      const imageFile = buildImageFile(tempImagePath);
      const result = await service.callOpenAI(payload, imageFile);

      assert.equal(result.success, false);
      assert.equal(result.error.code, "PROVIDER_RATE_LIMITED");
      assert.equal(result.error.status, 429);
    });

    it("should map 401 to INTERNAL_ERROR", async () => {
      global.fetch = createMockFetch([
        {
          ok: false,
          status: 401,
          text: "Unauthorized",
        },
      ]);

      const payload = buildValidPayload();
      const imageFile = buildImageFile(tempImagePath);
      const result = await service.callOpenAI(payload, imageFile);

      assert.equal(result.success, false);
      assert.equal(result.error.code, "INTERNAL_ERROR");
      assert.equal(result.error.status, 500);
    });

    it("should return structured output on success", async () => {
      global.fetch = createMockFetch([
        {
          ok: true,
          status: 200,
          json: {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    proposedPatch: {
                      power: 55,
                      speed: 180,
                      passes: 1,
                      dither: true,
                      mode: "raster",
                    },
                    warnings: ["Test on scrap material first."],
                    questions: [],
                    explanations: ["Balanced power and speed for clean lines."],
                  }),
                },
              },
            ],
          },
        },
      ]);

      const payload = buildValidPayload();
      const imageFile = buildImageFile(tempImagePath);
      const result = await service.callOpenAI(payload, imageFile);

      assert.equal(result.success, true);
      assert.equal(result.data.proposedPatch.power, 55);
      assert.equal(result.data.model, "gpt-4o-mini");
    });
  });
});
