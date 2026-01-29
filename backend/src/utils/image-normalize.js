"use strict";

const sharp = require("sharp");
const { downscaleToMaxBytes } = require("./image-downscale");

const SVG_UNSAFE_MESSAGE =
  "SVG contains unsupported or unsafe content; please export to PNG";

function buildValidationError(message, details) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.status = 400;
  error.details = details || null;
  return error;
}

function normalizeInputMimeType(mimeType) {
  if (!mimeType) {
    return "";
  }

  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  return mimeType;
}

function formatToMimeType(format) {
  if (!format) {
    return "";
  }

  switch (format.toLowerCase()) {
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "";
  }
}

function chooseRasterOutputType(inputMimeType, hasAlpha) {
  if (hasAlpha) {
    return "image/png";
  }

  if (inputMimeType === "image/png") {
    return "image/jpeg";
  }

  return "image/jpeg";
}

function looksLikeSvg(buffer, inputMimeType) {
  if (inputMimeType === "image/svg+xml") {
    return true;
  }

  const snippet = buffer.toString("utf8", 0, 512).trim().toLowerCase();
  return snippet.includes("<svg");
}

function assertSvgSafe(svgText, svgDataUriMaxBytes) {
  const lowered = svgText.toLowerCase();

  if (lowered.includes("<script")) {
    throw buildValidationError(SVG_UNSAFE_MESSAGE, {
      field: "image",
      reason: "svg_script",
    });
  }

  if (lowered.includes("<foreignobject")) {
    throw buildValidationError(SVG_UNSAFE_MESSAGE, {
      field: "image",
      reason: "svg_foreign_object",
    });
  }

  if (/\son\w+\s*=/.test(lowered)) {
    throw buildValidationError(SVG_UNSAFE_MESSAGE, {
      field: "image",
      reason: "svg_event_handler",
    });
  }

  const hrefMatches = lowered.match(/\b(?:xlink:href|href)\s*=\s*['"][^'"]+['"]/g);
  if (hrefMatches) {
    for (const match of hrefMatches) {
      const valueMatch = match.match(/['"]([^'"]+)['"]/);
      const value = valueMatch ? valueMatch[1].trim() : "";
      if (!value) {
        continue;
      }

      if (/^(https?:|file:)/.test(value)) {
        throw buildValidationError(SVG_UNSAFE_MESSAGE, {
          field: "image",
          reason: "svg_external_reference",
        });
      }

      if (value.startsWith("data:")) {
        if (value.length > svgDataUriMaxBytes) {
          throw buildValidationError(SVG_UNSAFE_MESSAGE, {
            field: "image",
            reason: "svg_data_uri_too_large",
          });
        }
      }
    }
  }
}

async function normalizeSvg({
  svgBuffer,
  maxBytes,
  maxDimensionPx,
  svgMaxBytes,
  svgDataUriMaxBytes,
  absMaxBytes,
}) {
  if (svgMaxBytes && svgBuffer.byteLength > svgMaxBytes) {
    throw buildValidationError(`image exceeds maximum size of ${svgMaxBytes} bytes`, {
      field: "image",
      maxBytes: svgMaxBytes,
      actualBytes: svgBuffer.byteLength,
    });
  }

  const svgText = svgBuffer.toString("utf8");
  assertSvgSafe(svgText, svgDataUriMaxBytes);

  const raster = sharp(Buffer.from(svgText), {
    density: 144,
    failOnError: false,
  }).resize({
    width: maxDimensionPx,
    height: maxDimensionPx,
    fit: "inside",
    withoutEnlargement: true,
  });

  const rasterBuffer = await raster.png().toBuffer();

  const downscaled = await downscaleToMaxBytes({
    inputBuffer: rasterBuffer,
    mimeType: "image/png",
    maxBytes,
    absMaxBytes,
    maxDimensionPx,
  });

  return {
    buffer: downscaled.buffer,
    mimeType: downscaled.mimeType,
    didDownscale: downscaled.didDownscale,
    originalBytes: svgBuffer.byteLength,
    finalBytes: downscaled.finalBytes,
    originalMimeType: "image/svg+xml",
    finalMimeType: downscaled.mimeType,
    didTransform: true,
    meta: {
      width: downscaled.width || null,
      height: downscaled.height || null,
      finalWidth: downscaled.finalWidth || null,
      finalHeight: downscaled.finalHeight || null,
      framesUsed: null,
      notes: "svg_rasterized",
    },
  };
}

async function normalizeGif({
  inputBuffer,
  inputMimeType,
  maxBytes,
  absMaxBytes,
  maxDimensionPx,
  metadata,
}) {
  const framesUsed = 1;
  const hasAlpha = metadata?.hasAlpha || false;
  const outputType = chooseRasterOutputType(inputMimeType, hasAlpha);

  const pipeline = sharp(inputBuffer, { animated: true, page: 0, failOnError: false });
  const rasterBuffer = outputType === "image/png"
    ? await pipeline.png().toBuffer()
    : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  const downscaled = await downscaleToMaxBytes({
    inputBuffer: rasterBuffer,
    mimeType: outputType,
    maxBytes,
    absMaxBytes,
    maxDimensionPx,
  });

  return {
    buffer: downscaled.buffer,
    mimeType: downscaled.mimeType,
    didDownscale: downscaled.didDownscale,
    originalBytes: inputBuffer.byteLength,
    finalBytes: downscaled.finalBytes,
    originalMimeType: inputMimeType,
    finalMimeType: downscaled.mimeType,
    didTransform: true,
    meta: {
      width: downscaled.width || metadata?.width || null,
      height: downscaled.height || metadata?.height || null,
      finalWidth: downscaled.finalWidth || null,
      finalHeight: downscaled.finalHeight || null,
      framesUsed,
      notes: metadata?.pages ? "gif_first_frame" : "gif_single_frame",
    },
  };
}

async function normalizeRaster({
  inputBuffer,
  inputMimeType,
  maxBytes,
  absMaxBytes,
  maxDimensionPx,
  metadata,
}) {
  const hasAlpha = metadata?.hasAlpha || false;
  const outputType = chooseRasterOutputType(inputMimeType, hasAlpha);
  let workingBuffer = inputBuffer;

  if (outputType !== inputMimeType) {
    const pipeline = sharp(inputBuffer, { failOnError: false });
    workingBuffer = outputType === "image/png"
      ? await pipeline.png().toBuffer()
      : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }

  const downscaled = await downscaleToMaxBytes({
    inputBuffer: workingBuffer,
    mimeType: outputType,
    maxBytes,
    absMaxBytes,
    maxDimensionPx,
  });

  return {
    buffer: downscaled.buffer,
    mimeType: downscaled.mimeType,
    didDownscale: downscaled.didDownscale,
    originalBytes: inputBuffer.byteLength,
    finalBytes: downscaled.finalBytes,
    originalMimeType: inputMimeType,
    finalMimeType: downscaled.mimeType,
    didTransform: inputMimeType !== downscaled.mimeType,
    meta: {
      width: downscaled.width || metadata?.width || null,
      height: downscaled.height || metadata?.height || null,
      finalWidth: downscaled.finalWidth || null,
      finalHeight: downscaled.finalHeight || null,
      framesUsed: null,
      notes: null,
    },
  };
}

/**
 * Normalize an input image buffer for OpenAI vision.
 *
 * @param {object} params
 * @param {Buffer} params.inputBuffer
 * @param {string} [params.inputMimeType]
 * @param {number} params.maxBytes
 * @param {number} params.absMaxBytes
 * @param {number} params.maxDimensionPx
 * @param {number} params.svgMaxBytes
 * @param {number} params.svgDataUriMaxBytes
 * @returns {Promise<{buffer: Buffer, mimeType: string, didTransform: boolean, didDownscale: boolean, originalBytes: number, finalBytes: number, originalMimeType: string, finalMimeType: string, meta: object}>}
 */
async function normalizeForAi({
  inputBuffer,
  inputMimeType,
  maxBytes,
  absMaxBytes,
  maxDimensionPx,
  svgMaxBytes,
  svgDataUriMaxBytes,
}) {
  if (!Buffer.isBuffer(inputBuffer)) {
    throw buildValidationError("image buffer is required", { field: "image" });
  }

  const originalBytes = inputBuffer.byteLength;
  if (absMaxBytes && originalBytes > absMaxBytes) {
    throw buildValidationError(`image exceeds maximum size of ${absMaxBytes} bytes`, {
      field: "image",
      maxBytes: absMaxBytes,
      actualBytes: originalBytes,
    });
  }

  const normalizedMimeType = normalizeInputMimeType(inputMimeType || "");

  if (looksLikeSvg(inputBuffer, normalizedMimeType)) {
    return normalizeSvg({
      svgBuffer: inputBuffer,
      maxBytes,
      maxDimensionPx,
      svgMaxBytes,
      svgDataUriMaxBytes,
      absMaxBytes,
    });
  }

  let metadata;
  try {
    metadata = await sharp(inputBuffer, { animated: true, failOnError: false }).metadata();
  } catch (error) {
    metadata = null;
  }

  const detectedMimeType = formatToMimeType(metadata?.format);
  const effectiveMimeType = normalizedMimeType || detectedMimeType;

  if (!effectiveMimeType) {
    throw buildValidationError("unsupported image type; please export to PNG", {
      field: "image",
    });
  }

  if (effectiveMimeType === "image/svg+xml") {
    return normalizeSvg({
      svgBuffer: inputBuffer,
      maxBytes,
      maxDimensionPx,
      svgMaxBytes,
      svgDataUriMaxBytes,
      absMaxBytes,
    });
  }

  if (effectiveMimeType === "image/gif") {
    return normalizeGif({
      inputBuffer,
      inputMimeType: effectiveMimeType,
      maxBytes,
      absMaxBytes,
      maxDimensionPx,
      metadata,
    });
  }

  if (effectiveMimeType === "image/png" || effectiveMimeType === "image/jpeg") {
    return normalizeRaster({
      inputBuffer,
      inputMimeType: effectiveMimeType,
      maxBytes,
      absMaxBytes,
      maxDimensionPx,
      metadata,
    });
  }

  if (effectiveMimeType === "image/webp") {
    return normalizeRaster({
      inputBuffer,
      inputMimeType: effectiveMimeType,
      maxBytes,
      absMaxBytes,
      maxDimensionPx,
      metadata,
    });
  }

  throw buildValidationError("unsupported image type; please export to PNG", {
    field: "image",
  });
}

module.exports = {
  normalizeForAi,
};
