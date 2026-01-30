/**
 * Engrave Assistant Service (Portal AI API - Stage 2)
 *
 * Handles OpenAI integration for image-based settings proposals.
 * This is the service boundary - controllers call this, not OpenAI directly.
 *
 * Privacy: Never logs prompts or image content.
 * Stability: Maps all provider errors to stable portal error codes.
 */

"use strict";

const fs = require("node:fs/promises");
const { normalizeForAi } = require("../../../utils/image-normalize");

// Error codes that map to portal error codes
const ProviderErrorCodes = {
  TIMEOUT: "PROVIDER_TIMEOUT",
  RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  AUTH_ERROR: "INTERNAL_ERROR", // Server misconfig - don't expose
  BAD_REQUEST: "VALIDATION_ERROR",
  SERVER_ERROR: "PROVIDER_ERROR",
  NETWORK_ERROR: "PROVIDER_ERROR",
  MISCONFIGURED: "INTERNAL_ERROR",
};

const SYSTEM_PROMPT = `You are the LightLane Engrave Assistant.
You analyze a user-provided design image and propose a settings patch ONLY for keys explicitly allowed by availableSettings.
Return a patch proposal only; do not apply settings and do not invent new keys.
If information is missing, ask concise questions in the questions array.
Keep explanations brief and focused on why each proposed change helps.`;

const ALLOWED_SETTING_TYPES = new Set(["string", "number", "integer", "boolean"]);
const ALLOWED_SETTING_FIELDS = new Set([
  "type",
  "enum",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "description",
  "unit",
]);

/**
 * Get environment configuration with defaults
 */
function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_OPENAI_MODEL || "gpt-4o-mini",
    timeoutMs: parseInt(process.env.AI_OPENAI_TIMEOUT_MS, 10) || 15000,
    maxPromptChars: parseInt(process.env.AI_ENGRAVE_MAX_PROMPT_CHARS, 10) || 2000,
    maxContextChars: parseInt(process.env.AI_ENGRAVE_MAX_CONTEXT_CHARS, 10) || 4000,
    maxSettingsKeys: parseInt(process.env.AI_ENGRAVE_MAX_SETTINGS_KEYS, 10) || 50,
    maxSettingsSchemaChars:
      parseInt(process.env.AI_ENGRAVE_MAX_SETTINGS_SCHEMA_CHARS, 10) || 10000,
    maxImageBytes: parseInt(process.env.AI_ENGRAVE_MAX_IMAGE_BYTES, 10) || 5 * 1024 * 1024,
    absMaxImageBytes:
      parseInt(process.env.AI_ENGRAVE_ABS_MAX_IMAGE_BYTES, 10) || 40 * 1024 * 1024,
    maxImageDimensionPx:
      parseInt(process.env.AI_ENGRAVE_MAX_IMAGE_DIM_PX, 10) || 2048,
    svgMaxBytes: parseInt(process.env.AI_ENGRAVE_SVG_MAX_BYTES, 10) || 2 * 1024 * 1024,
    svgDataUriMaxBytes:
      parseInt(process.env.AI_ENGRAVE_SVG_DATA_URI_MAX_BYTES, 10) || 200 * 1024,
    allowedImageTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ],
  };
}

function getImageType(imageFile) {
  return imageFile?.type || imageFile?.mimetype || imageFile?.mime || "";
}

function getImagePath(imageFile) {
  return imageFile?.path || imageFile?.filepath || imageFile?.tmpPath || null;
}

/**
 * Validate the request payload + image
 *
 * @param {object} payload - Parsed payload JSON
 * @param {object|null} imageFile - Uploaded image file descriptor
 * @returns {{ valid: boolean, error?: string, details?: object }}
 */
function validateRequest(payload, imageFile) {
  const config = getConfig();

  if (!imageFile) {
    return {
      valid: false,
      error: "image is required",
      details: { field: "image" },
    };
  }

  const imageSize = Number(imageFile.size || 0);
  if (imageSize <= 0) {
    return {
      valid: false,
      error: "image is empty",
      details: { field: "image" },
    };
  }

  if (imageSize > config.absMaxImageBytes) {
    return {
      valid: false,
      error: `image exceeds maximum size of ${config.absMaxImageBytes} bytes`,
      details: {
        field: "image",
        maxBytes: config.absMaxImageBytes,
        actualBytes: imageSize,
      },
    };
  }

  const imagePath = getImagePath(imageFile);
  if (!imagePath) {
    return {
      valid: false,
      error: "image upload is missing a file path",
      details: { field: "image" },
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      valid: false,
      error: "payload is required",
      details: { field: "payload" },
    };
  }

  if (typeof payload.prompt !== "string") {
    return {
      valid: false,
      error: "prompt is required and must be a string",
      details: { field: "prompt" },
    };
  }

  const promptLength = payload.prompt.trim().length;
  if (promptLength === 0) {
    return {
      valid: false,
      error: "prompt cannot be empty",
      details: { field: "prompt" },
    };
  }

  if (promptLength > config.maxPromptChars) {
    return {
      valid: false,
      error: `prompt exceeds maximum length of ${config.maxPromptChars} characters`,
      details: { field: "prompt", maxLength: config.maxPromptChars, actualLength: promptLength },
    };
  }

  if (payload.context !== undefined) {
    if (typeof payload.context !== "object" || payload.context === null) {
      return {
        valid: false,
        error: "context must be an object",
        details: { field: "context" },
      };
    }

    try {
      const contextSize = JSON.stringify(payload.context).length;
      if (contextSize > config.maxContextChars) {
        return {
          valid: false,
          error: `context exceeds maximum size of ${config.maxContextChars} characters`,
          details: { field: "context", maxChars: config.maxContextChars, actualChars: contextSize },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: "context must be JSON-serializable",
        details: { field: "context" },
      };
    }
  }

  if (payload.availableSettings === undefined) {
    return {
      valid: false,
      error: "availableSettings is required",
      details: { field: "availableSettings" },
    };
  }

  const settingsValidation = validateAvailableSettings(payload.availableSettings, config);
  if (!settingsValidation.valid) {
    return settingsValidation;
  }

  return { valid: true };
}

function validateAvailableSettings(availableSettings, config) {
  if (
    typeof availableSettings !== "object" ||
    availableSettings === null ||
    Array.isArray(availableSettings)
  ) {
    return {
      valid: false,
      error: "availableSettings must be an object",
      details: { field: "availableSettings" },
    };
  }

  const keys = Object.keys(availableSettings);
  if (keys.length === 0) {
    return {
      valid: false,
      error: "availableSettings must include at least one setting",
      details: { field: "availableSettings" },
    };
  }

  if (keys.length > config.maxSettingsKeys) {
    return {
      valid: false,
      error: `availableSettings exceeds maximum of ${config.maxSettingsKeys} keys`,
      details: {
        field: "availableSettings",
        maxKeys: config.maxSettingsKeys,
        actualKeys: keys.length,
      },
    };
  }

  try {
    const schemaSize = JSON.stringify(availableSettings).length;
    if (schemaSize > config.maxSettingsSchemaChars) {
      return {
        valid: false,
        error: `availableSettings exceeds maximum size of ${config.maxSettingsSchemaChars} characters`,
        details: {
          field: "availableSettings",
          maxChars: config.maxSettingsSchemaChars,
          actualChars: schemaSize,
        },
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: "availableSettings must be JSON-serializable",
      details: { field: "availableSettings" },
    };
  }

  for (const key of keys) {
    const constraint = availableSettings[key];
    if (typeof constraint !== "object" || constraint === null || Array.isArray(constraint)) {
      return {
        valid: false,
        error: `availableSettings.${key} must be an object`,
        details: { field: `availableSettings.${key}` },
      };
    }

    const unknownFields = Object.keys(constraint).filter(
      (field) => !ALLOWED_SETTING_FIELDS.has(field)
    );
    if (unknownFields.length > 0) {
      return {
        valid: false,
        error: `availableSettings.${key} has unsupported fields: ${unknownFields.join(", ")}`,
        details: { field: `availableSettings.${key}`, unsupported: unknownFields },
      };
    }

    if (!constraint.type || typeof constraint.type !== "string") {
      return {
        valid: false,
        error: `availableSettings.${key}.type is required`,
        details: { field: `availableSettings.${key}.type` },
      };
    }

    if (!ALLOWED_SETTING_TYPES.has(constraint.type)) {
      return {
        valid: false,
        error: `availableSettings.${key}.type must be one of ${[...ALLOWED_SETTING_TYPES].join(", ")}`,
        details: { field: `availableSettings.${key}.type` },
      };
    }

    if (constraint.enum !== undefined) {
      if (!Array.isArray(constraint.enum) || constraint.enum.length === 0) {
        return {
          valid: false,
          error: `availableSettings.${key}.enum must be a non-empty array`,
          details: { field: `availableSettings.${key}.enum` },
        };
      }
    }

    if (constraint.type === "string") {
      if (constraint.minLength !== undefined && !Number.isInteger(constraint.minLength)) {
        return {
          valid: false,
          error: `availableSettings.${key}.minLength must be an integer`,
          details: { field: `availableSettings.${key}.minLength` },
        };
      }

      if (constraint.maxLength !== undefined && !Number.isInteger(constraint.maxLength)) {
        return {
          valid: false,
          error: `availableSettings.${key}.maxLength must be an integer`,
          details: { field: `availableSettings.${key}.maxLength` },
        };
      }

      if (
        constraint.minLength !== undefined &&
        constraint.maxLength !== undefined &&
        constraint.minLength > constraint.maxLength
      ) {
        return {
          valid: false,
          error: `availableSettings.${key}.minLength cannot exceed maxLength`,
          details: { field: `availableSettings.${key}` },
        };
      }

      if (constraint.enum) {
        for (const value of constraint.enum) {
          if (typeof value !== "string") {
            return {
              valid: false,
              error: `availableSettings.${key}.enum values must be strings`,
              details: { field: `availableSettings.${key}.enum` },
            };
          }
        }
      }
    }

    if (constraint.type === "number" || constraint.type === "integer") {
      if (constraint.minimum !== undefined && typeof constraint.minimum !== "number") {
        return {
          valid: false,
          error: `availableSettings.${key}.minimum must be a number`,
          details: { field: `availableSettings.${key}.minimum` },
        };
      }

      if (constraint.maximum !== undefined && typeof constraint.maximum !== "number") {
        return {
          valid: false,
          error: `availableSettings.${key}.maximum must be a number`,
          details: { field: `availableSettings.${key}.maximum` },
        };
      }

      if (
        constraint.minimum !== undefined &&
        constraint.maximum !== undefined &&
        constraint.minimum > constraint.maximum
      ) {
        return {
          valid: false,
          error: `availableSettings.${key}.minimum cannot exceed maximum`,
          details: { field: `availableSettings.${key}` },
        };
      }

      if (constraint.enum) {
        for (const value of constraint.enum) {
          if (typeof value !== "number") {
            return {
              valid: false,
              error: `availableSettings.${key}.enum values must be numbers`,
              details: { field: `availableSettings.${key}.enum` },
            };
          }
          if (constraint.type === "integer" && !Number.isInteger(value)) {
            return {
              valid: false,
              error: `availableSettings.${key}.enum values must be integers`,
              details: { field: `availableSettings.${key}.enum` },
            };
          }
        }
      }
    }

    if (constraint.type === "integer") {
      if (constraint.minimum !== undefined && !Number.isInteger(constraint.minimum)) {
        return {
          valid: false,
          error: `availableSettings.${key}.minimum must be an integer`,
          details: { field: `availableSettings.${key}.minimum` },
        };
      }

      if (constraint.maximum !== undefined && !Number.isInteger(constraint.maximum)) {
        return {
          valid: false,
          error: `availableSettings.${key}.maximum must be an integer`,
          details: { field: `availableSettings.${key}.maximum` },
        };
      }
    }

    if (constraint.type === "boolean" && constraint.enum) {
      for (const value of constraint.enum) {
        if (typeof value !== "boolean") {
          return {
            valid: false,
            error: `availableSettings.${key}.enum values must be booleans`,
            details: { field: `availableSettings.${key}.enum` },
          };
        }
      }
    }
  }

  return { valid: true };
}

function buildSettingSchema(constraint) {
  const schema = { type: constraint.type };

  if (constraint.enum) {
    schema.enum = constraint.enum;
  }

  if (constraint.type === "string") {
    if (Number.isInteger(constraint.minLength)) {
      schema.minLength = constraint.minLength;
    }
    if (Number.isInteger(constraint.maxLength)) {
      schema.maxLength = constraint.maxLength;
    }
  }

  if (constraint.type === "number" || constraint.type === "integer") {
    if (typeof constraint.minimum === "number") {
      schema.minimum = constraint.minimum;
    }
    if (typeof constraint.maximum === "number") {
      schema.maximum = constraint.maximum;
    }
  }

  return schema;
}

function buildResponseSchema(availableSettings) {
  const properties = {};
  const requiredKeys = [];
  
  for (const [key, constraint] of Object.entries(availableSettings)) {
    properties[key] = buildSettingSchema(constraint);
    requiredKeys.push(key);
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["proposedPatch", "warnings", "questions", "explanations"],
    properties: {
      proposedPatch: {
        type: "object",
        additionalProperties: false,
        required: requiredKeys,
        properties,
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      questions: {
        type: "array",
        items: { type: "string" },
      },
      explanations: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

function buildUserMessage(payload) {
  const prompt = payload.prompt.trim();
  const context = payload.context || {};
  const availableSettings = payload.availableSettings || {};

  return [
    `User goal:\n${prompt}`,
    "",
    "Context:",
    JSON.stringify(context, null, 2),
    "",
    "Available settings schema (only these keys may be used):",
    JSON.stringify(availableSettings, null, 2),
  ].join("\n");
}

function validatePatchAgainstAvailableSettings(proposedPatch, availableSettings) {
  if (typeof proposedPatch !== "object" || proposedPatch === null || Array.isArray(proposedPatch)) {
    return {
      valid: false,
      error: "proposedPatch must be an object",
    };
  }

  for (const [key, value] of Object.entries(proposedPatch)) {
    const constraint = availableSettings[key];
    if (!constraint) {
      return {
        valid: false,
        error: `proposedPatch contains unsupported key: ${key}`,
      };
    }

    if (constraint.type === "string") {
      if (typeof value !== "string") {
        return { valid: false, error: `proposedPatch.${key} must be a string` };
      }
      if (Number.isInteger(constraint.minLength) && value.length < constraint.minLength) {
        return { valid: false, error: `proposedPatch.${key} is shorter than minLength` };
      }
      if (Number.isInteger(constraint.maxLength) && value.length > constraint.maxLength) {
        return { valid: false, error: `proposedPatch.${key} exceeds maxLength` };
      }
      if (constraint.enum && !constraint.enum.includes(value)) {
        return { valid: false, error: `proposedPatch.${key} must be one of enum values` };
      }
    }

    if (constraint.type === "number") {
      if (typeof value !== "number") {
        return { valid: false, error: `proposedPatch.${key} must be a number` };
      }
      if (typeof constraint.minimum === "number" && value < constraint.minimum) {
        return { valid: false, error: `proposedPatch.${key} is below minimum` };
      }
      if (typeof constraint.maximum === "number" && value > constraint.maximum) {
        return { valid: false, error: `proposedPatch.${key} exceeds maximum` };
      }
      if (constraint.enum && !constraint.enum.includes(value)) {
        return { valid: false, error: `proposedPatch.${key} must be one of enum values` };
      }
    }

    if (constraint.type === "integer") {
      if (!Number.isInteger(value)) {
        return { valid: false, error: `proposedPatch.${key} must be an integer` };
      }
      if (typeof constraint.minimum === "number" && value < constraint.minimum) {
        return { valid: false, error: `proposedPatch.${key} is below minimum` };
      }
      if (typeof constraint.maximum === "number" && value > constraint.maximum) {
        return { valid: false, error: `proposedPatch.${key} exceeds maximum` };
      }
      if (constraint.enum && !constraint.enum.includes(value)) {
        return { valid: false, error: `proposedPatch.${key} must be one of enum values` };
      }
    }

    if (constraint.type === "boolean") {
      if (typeof value !== "boolean") {
        return { valid: false, error: `proposedPatch.${key} must be a boolean` };
      }
      if (constraint.enum && !constraint.enum.includes(value)) {
        return { valid: false, error: `proposedPatch.${key} must be one of enum values` };
      }
    }
  }

  return { valid: true };
}

function extractStructuredOutput(data) {
  // For chat/completions with structured outputs, response is in choices[0].message.content
  const message = data?.choices?.[0]?.message;
  if (!message) {
    return null;
  }

  // With JSON schema mode, content is a JSON string
  if (typeof message.content === "string") {
    try {
      return JSON.parse(message.content);
    } catch (error) {
      return null;
    }
  }

  // Fallback if content is already parsed
  if (typeof message.content === "object") {
    return message.content;
  }

  return null;
}

/**
 * Call OpenAI API (Responses API with vision + structured outputs)
 *
 * @param {object} payload - Parsed payload
 * @param {object} imageFile - Uploaded file descriptor
 * @returns {Promise<{ success: boolean, data?: object, error?: object }>} 
 */
async function callOpenAI(payload, imageFile) {
  const config = getConfig();
  const startTime = Date.now();

  if (!config.apiKey) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.MISCONFIGURED,
        status: 500,
        message: "AI service is not configured",
      },
      latencyMs: Date.now() - startTime,
    };
  }

  const imagePath = getImagePath(imageFile);
  let imageBuffer;
  try {
    imageBuffer = await fs.readFile(imagePath);
  } catch (error) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.SERVER_ERROR,
        status: 500,
        message: "Failed to read uploaded image",
      },
      latencyMs: Date.now() - startTime,
    };
  }

  const imageType = getImageType(imageFile);
  let normalizeResult;

  try {
    normalizeResult = await normalizeForAi({
      inputBuffer: imageBuffer,
      inputMimeType: imageType,
      maxBytes: config.maxImageBytes,
      absMaxBytes: config.absMaxImageBytes,
      maxDimensionPx: config.maxImageDimensionPx,
      svgMaxBytes: config.svgMaxBytes,
      svgDataUriMaxBytes: config.svgDataUriMaxBytes,
    });
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code || ProviderErrorCodes.BAD_REQUEST,
        status: error.status || 400,
        message: error.message || "image could not be processed",
        details: error.details || null,
      },
      latencyMs: Date.now() - startTime,
      imageMeta: {
        imageDownscaled: false,
        imageTransformed: false,
        originalBytes: imageBuffer.byteLength,
        finalBytes: null,
        originalWidth: null,
        originalHeight: null,
        finalWidth: null,
        finalHeight: null,
        originalMimeType: imageType || null,
        finalMimeType: null,
        framesUsed: null,
      },
    };
  }

  const imageDataUrl = `data:${normalizeResult.mimeType};base64,${normalizeResult.buffer.toString("base64")}`;
  const responseSchema = buildResponseSchema(payload.availableSettings);

  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserMessage(payload) },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "engrave_settings_patch",
        schema: responseSchema,
        strict: true,
      },
    },
    temperature: 0.2,
    max_tokens: 700,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      if (typeof strapi !== "undefined" && strapi.log) {
        strapi.log.error(`[AI] OpenAI error ${response.status}: ${errorBody.substring(0, 500)}`);
      }
      const mapped = mapProviderError(response.status, errorBody, latencyMs);
      return {
        ...mapped,
        imageMeta: {
          imageDownscaled: normalizeResult.didDownscale,
          imageTransformed: normalizeResult.didTransform,
          originalBytes: normalizeResult.originalBytes,
          finalBytes: normalizeResult.finalBytes,
          originalWidth: normalizeResult.meta?.width || null,
          originalHeight: normalizeResult.meta?.height || null,
          finalWidth: normalizeResult.meta?.finalWidth || null,
          finalHeight: normalizeResult.meta?.finalHeight || null,
          originalMimeType: normalizeResult.originalMimeType,
          finalMimeType: normalizeResult.finalMimeType,
          framesUsed: normalizeResult.meta?.framesUsed || null,
        },
      };
    }

    const data = await response.json();
    const structured = extractStructuredOutput(data);

    if (!structured || typeof structured !== "object") {
      return {
        success: false,
        error: {
          code: ProviderErrorCodes.SERVER_ERROR,
          status: 502,
          message: "Invalid response from AI provider",
        },
        latencyMs,
      };
    }

    const proposedPatch = structured.proposedPatch;
    const warnings = Array.isArray(structured.warnings) ? structured.warnings : [];
    const questions = Array.isArray(structured.questions) ? structured.questions : [];
    const explanations = Array.isArray(structured.explanations) ? structured.explanations : [];

    const patchValidation = validatePatchAgainstAvailableSettings(
      proposedPatch,
      payload.availableSettings
    );
    if (!patchValidation.valid) {
      return {
        success: false,
        error: {
          code: ProviderErrorCodes.SERVER_ERROR,
          status: 502,
          message: "AI provider response did not match expected schema",
        },
        latencyMs,
      };
    }

    return {
      success: true,
      data: {
        proposedPatch,
        warnings,
        questions,
        explanations,
        model: config.model,
      },
      latencyMs,
      imageMeta: {
        imageDownscaled: normalizeResult.didDownscale,
        imageTransformed: normalizeResult.didTransform,
        originalBytes: normalizeResult.originalBytes,
        finalBytes: normalizeResult.finalBytes,
        originalWidth: normalizeResult.meta?.width || null,
        originalHeight: normalizeResult.meta?.height || null,
        finalWidth: normalizeResult.meta?.finalWidth || null,
        finalHeight: normalizeResult.meta?.finalHeight || null,
        originalMimeType: normalizeResult.originalMimeType,
        finalMimeType: normalizeResult.finalMimeType,
        framesUsed: normalizeResult.meta?.framesUsed || null,
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (err.name === "AbortError") {
      return {
        success: false,
        error: {
          code: ProviderErrorCodes.TIMEOUT,
          status: 504,
          message: "AI request timed out",
        },
        latencyMs,
        imageMeta: normalizeResult
          ? {
              imageDownscaled: normalizeResult.didDownscale,
              imageTransformed: normalizeResult.didTransform,
              originalBytes: normalizeResult.originalBytes,
              finalBytes: normalizeResult.finalBytes,
              originalWidth: normalizeResult.meta?.width || null,
              originalHeight: normalizeResult.meta?.height || null,
              finalWidth: normalizeResult.meta?.finalWidth || null,
              finalHeight: normalizeResult.meta?.finalHeight || null,
              originalMimeType: normalizeResult.originalMimeType,
              finalMimeType: normalizeResult.finalMimeType,
              framesUsed: normalizeResult.meta?.framesUsed || null,
            }
          : null,
      };
    }

    return {
      success: false,
      error: {
        code: ProviderErrorCodes.NETWORK_ERROR,
        status: 502,
        message: "Failed to connect to AI provider",
      },
      latencyMs,
      imageMeta: normalizeResult
        ? {
            imageDownscaled: normalizeResult.didDownscale,
            imageTransformed: normalizeResult.didTransform,
            originalBytes: normalizeResult.originalBytes,
            finalBytes: normalizeResult.finalBytes,
            originalWidth: normalizeResult.meta?.width || null,
            originalHeight: normalizeResult.meta?.height || null,
            finalWidth: normalizeResult.meta?.finalWidth || null,
            finalHeight: normalizeResult.meta?.finalHeight || null,
            originalMimeType: normalizeResult.originalMimeType,
            finalMimeType: normalizeResult.finalMimeType,
            framesUsed: normalizeResult.meta?.framesUsed || null,
          }
        : null,
    };
  }
}

/**
 * Map provider HTTP status to portal error
 *
 * @param {number} status - HTTP status from OpenAI
 * @param {string} body - Response body (for logging, not exposed)
 * @param {number} latencyMs - Request latency
 * @returns {{ success: false, error: object, latencyMs: number }}
 */
function mapProviderError(status, body, latencyMs) {
  if (status === 401 || status === 403) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.AUTH_ERROR,
        status: 500,
        message: "AI service configuration error",
      },
      latencyMs,
    };
  }

  if (status === 429) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.RATE_LIMITED,
        status: 429,
        message: "AI provider rate limit exceeded. Please try again later.",
      },
      latencyMs,
    };
  }

  if (status === 400) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.BAD_REQUEST,
        status: 400,
        message: "Invalid request to AI provider",
      },
      latencyMs,
    };
  }

  if (status >= 500) {
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.SERVER_ERROR,
        status: 502,
        message: "AI provider is temporarily unavailable",
      },
      latencyMs,
    };
  }

  return {
    success: false,
    error: {
      code: ProviderErrorCodes.SERVER_ERROR,
      status: 502,
      message: "Unexpected error from AI provider",
    },
    latencyMs,
  };
}

module.exports = {
  validateRequest,
  callOpenAI,
  getConfig,
  ProviderErrorCodes,
  mapProviderError,
  buildUserMessage,
  buildResponseSchema,
  validateAvailableSettings,
};
