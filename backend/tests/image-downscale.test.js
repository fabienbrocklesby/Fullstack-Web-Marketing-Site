"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharp = require("sharp");

const { downscaleToMaxBytes } = require("../src/utils/image-downscale");

async function createSolidPngBuffer(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .png()
    .toBuffer();
}

async function createRandomPngBuffer(width, height) {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return sharp(raw, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

describe("image-downscale", () => {
  it("should return original buffer when under max bytes", async () => {
    const buffer = await createSolidPngBuffer(64, 64);
    const result = await downscaleToMaxBytes({
      inputBuffer: buffer,
      mimeType: "image/png",
      maxBytes: buffer.byteLength + 1024,
      maxDimensionPx: 2048,
      absMaxBytes: buffer.byteLength + 2048,
    });

    assert.equal(result.didDownscale, false);
    assert.equal(result.finalBytes, buffer.byteLength);
    assert.ok(result.buffer.equals(buffer));
  });

  it("should downscale oversized buffers to fit max bytes", async () => {
    const buffer = await createRandomPngBuffer(1200, 1200);
    const result = await downscaleToMaxBytes({
      inputBuffer: buffer,
      mimeType: "image/png",
      maxBytes: 400000,
      maxDimensionPx: 1024,
      absMaxBytes: 8000000,
    });

    assert.equal(result.didDownscale, true);
    assert.ok(result.finalBytes <= 400000);
  });

  it("should reject buffers above absolute max bytes", async () => {
    const buffer = Buffer.alloc(1024 * 1024 * 5 + 1);

    await assert.rejects(async () => {
      await downscaleToMaxBytes({
        inputBuffer: buffer,
        mimeType: "image/png",
        maxBytes: 1000,
        maxDimensionPx: 512,
        absMaxBytes: 1024 * 1024 * 5,
      });
    }, /exceeds maximum size/i);
  });
});
