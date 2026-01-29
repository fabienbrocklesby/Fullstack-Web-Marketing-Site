"use strict";

const sharp = require("sharp");

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_MIN_DIMENSION_PX = 256;
const DEFAULT_JPEG_QUALITY_START = 82;
const DEFAULT_JPEG_QUALITY_MIN = 40;

function normalizeInputMimeType(mimeType) {
  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return mimeType;
  }

  return "image/png";
}

function chooseOutputMimeType(inputType, hasAlpha) {
  if (inputType === "image/png" && !hasAlpha) {
    return "image/jpeg";
  }

  if (inputType === "image/jpeg" || inputType === "image/png") {
    return inputType;
  }

  return hasAlpha ? "image/png" : "image/jpeg";
}

function buildValidationError(message, details) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.status = 400;
  error.details = details || null;
  return error;
}

async function encodeImage({
  inputBuffer,
  mimeType,
  width,
  height,
  maxDimensionPx,
  jpegQuality,
}) {
  let pipeline = sharp(inputBuffer, { failOnError: false });

  if (width && height && maxDimensionPx) {
    const resizeOptions = {
      fit: "inside",
      withoutEnlargement: true,
    };

    if (width >= height) {
      resizeOptions.width = maxDimensionPx;
    } else {
      resizeOptions.height = maxDimensionPx;
    }

    pipeline = pipeline.resize(resizeOptions);
  }

  if (mimeType === "image/jpeg") {
    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  return pipeline.toBuffer({ resolveWithObject: true });
}

/**
 * Downscale image buffer to fit within max bytes.
 *
 * @param {object} params
 * @param {Buffer} params.inputBuffer
 * @param {string} params.mimeType
 * @param {number} params.maxBytes
 * @param {number} params.maxDimensionPx
 * @param {number} [params.absMaxBytes]
 * @param {number} [params.maxAttempts]
 * @returns {Promise<{buffer: Buffer, mimeType: string, didDownscale: boolean, originalBytes: number, finalBytes: number, width?: number, height?: number, finalWidth?: number, finalHeight?: number}>}
 */
async function downscaleToMaxBytes({
  inputBuffer,
  mimeType,
  maxBytes,
  maxDimensionPx,
  absMaxBytes,
  maxAttempts,
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

  let metadata;
  try {
    metadata = await sharp(inputBuffer, { failOnError: false }).metadata();
  } catch (error) {
    throw buildValidationError("image could not be processed", { field: "image" });
  }

  const width = metadata?.width || null;
  const height = metadata?.height || null;
  const hasAlpha = metadata?.hasAlpha || false;
  const inputType = normalizeInputMimeType(mimeType);
  const outputType = chooseOutputMimeType(inputType, hasAlpha);

  if (originalBytes <= maxBytes) {
    return {
      buffer: inputBuffer,
      mimeType: inputType,
      didDownscale: false,
      originalBytes,
      finalBytes: originalBytes,
      width,
      height,
      finalWidth: width,
      finalHeight: height,
    };
  }

  const maxSide = width && height ? Math.max(width, height) : maxDimensionPx;
  let currentMaxDimension = Math.min(maxDimensionPx || maxSide, maxSide || maxDimensionPx);
  if (!currentMaxDimension) {
    currentMaxDimension = maxDimensionPx || DEFAULT_MIN_DIMENSION_PX;
  }

  const attempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  let currentQuality = DEFAULT_JPEG_QUALITY_START;
  let bestResult = {
    buffer: inputBuffer,
    bytes: originalBytes,
    width,
    height,
    mimeType: outputType,
  };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let encoded;
    try {
      encoded = await encodeImage({
        inputBuffer,
        mimeType: outputType,
        width,
        height,
        maxDimensionPx: currentMaxDimension,
        jpegQuality: currentQuality,
      });
    } catch (error) {
      throw buildValidationError("image could not be processed", { field: "image" });
    }

    const data = encoded.data;
    const info = encoded.info || {};

    if (data.byteLength < bestResult.bytes) {
      bestResult = {
        buffer: data,
        bytes: data.byteLength,
        width: info.width || width,
        height: info.height || height,
        mimeType: outputType,
      };
    }

    if (data.byteLength <= maxBytes) {
      return {
        buffer: data,
        mimeType: outputType,
        didDownscale: true,
        originalBytes,
        finalBytes: data.byteLength,
        width,
        height,
        finalWidth: info.width || width,
        finalHeight: info.height || height,
      };
    }

    if (outputType === "image/jpeg") {
      currentQuality = Math.max(currentQuality - 12, DEFAULT_JPEG_QUALITY_MIN);
    }

    currentMaxDimension = Math.max(
      Math.floor(currentMaxDimension * 0.8),
      DEFAULT_MIN_DIMENSION_PX
    );
  }

  throw buildValidationError(`image exceeds maximum size of ${maxBytes} bytes`, {
    field: "image",
    maxBytes,
    actualBytes: originalBytes,
    attemptedBytes: bestResult.bytes,
  });
}

module.exports = {
  downscaleToMaxBytes,
};
