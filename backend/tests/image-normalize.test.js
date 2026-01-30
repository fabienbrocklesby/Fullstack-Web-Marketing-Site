"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharp = require("sharp");

const { normalizeForAi } = require("../src/utils/image-normalize");

async function createWebpBuffer(width, height) {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .webp({ quality: 80 })
    .toBuffer();
}

async function createGifBuffer() {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 3,
      background: { r: 120, g: 120, b: 120 },
    },
  })
    .gif({ loop: 0 })
    .toBuffer();
}

async function createPngBuffer() {
  return sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

describe("image-normalize", () => {
  it("should normalize WEBP and downscale when oversized", async () => {
    const buffer = await createWebpBuffer(1600, 1600);
    const result = await normalizeForAi({
      inputBuffer: buffer,
      inputMimeType: "image/webp",
      maxBytes: 300000,
      absMaxBytes: 8000000,
      maxDimensionPx: 1024,
      svgMaxBytes: 2 * 1024 * 1024,
      svgDataUriMaxBytes: 200 * 1024,
    });

    assert.ok(result.finalBytes <= 300000);
    assert.equal(result.originalMimeType, "image/webp");
    assert.ok(result.finalMimeType.startsWith("image/"));
  });

  it("should normalize GIF using first frame", async () => {
    const buffer = await createGifBuffer();
    const result = await normalizeForAi({
      inputBuffer: buffer,
      inputMimeType: "image/gif",
      maxBytes: 200000,
      absMaxBytes: 4000000,
      maxDimensionPx: 512,
      svgMaxBytes: 2 * 1024 * 1024,
      svgDataUriMaxBytes: 200 * 1024,
    });

    assert.equal(result.originalMimeType, "image/gif");
    assert.equal(result.meta.framesUsed, 1);
    assert.ok(result.finalMimeType.startsWith("image/"));
  });

  it("should rasterize safe SVG", async () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ccc"/></svg>`;
    const result = await normalizeForAi({
      inputBuffer: Buffer.from(svg, "utf8"),
      inputMimeType: "image/svg+xml",
      maxBytes: 200000,
      absMaxBytes: 4000000,
      maxDimensionPx: 512,
      svgMaxBytes: 2 * 1024 * 1024,
      svgDataUriMaxBytes: 200 * 1024,
    });

    assert.equal(result.originalMimeType, "image/svg+xml");
    assert.equal(result.didTransform, true);
    assert.ok(result.finalMimeType.startsWith("image/"));
  });

  it("should reject unsafe SVG", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;

    await assert.rejects(async () => {
      await normalizeForAi({
        inputBuffer: Buffer.from(svg, "utf8"),
        inputMimeType: "image/svg+xml",
        maxBytes: 200000,
        absMaxBytes: 4000000,
        maxDimensionPx: 512,
        svgMaxBytes: 2 * 1024 * 1024,
        svgDataUriMaxBytes: 200 * 1024,
      });
    }, /unsupported or unsafe content/i);
  });

  it("should accept unknown mime if image decodes", async () => {
    const buffer = await createPngBuffer();
    const result = await normalizeForAi({
      inputBuffer: buffer,
      inputMimeType: "",
      maxBytes: 200000,
      absMaxBytes: 4000000,
      maxDimensionPx: 512,
      svgMaxBytes: 2 * 1024 * 1024,
      svgDataUriMaxBytes: 200 * 1024,
    });

    assert.ok(result.finalBytes <= 200000);
    assert.equal(result.originalMimeType, "image/png");
  });
});
