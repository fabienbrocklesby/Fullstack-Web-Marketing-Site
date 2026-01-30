/**
 * Settings Assistant Service (Portal AI API - Stage 1)
 *
 * Handles OpenAI integration for the Settings Assistant feature.
 * This is the service boundary - controllers call this, not OpenAI directly.
 *
 * Privacy: Never logs prompts or settings content.
 * Stability: Maps all provider errors to stable portal error codes.
 */

"use strict";

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

// System prompt for the Settings Assistant
const SYSTEM_PROMPT = `You are a helpful assistant for LightLane, a design software application.
Your role is to help users understand and configure LightLane settings and features.
Be concise, friendly, and helpful. If you don't know the answer, say so.
Focus only on LightLane-related questions. For unrelated questions, politely redirect to LightLane topics.`;

/**
 * Get environment configuration with defaults
 */
function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_OPENAI_MODEL || "gpt-4o-mini",
    timeoutMs: parseInt(process.env.AI_OPENAI_TIMEOUT_MS, 10) || 15000,
    maxPromptChars: parseInt(process.env.AI_SETTINGS_MAX_PROMPT_CHARS, 10) || 2000,
    maxContextKeys: parseInt(process.env.AI_SETTINGS_MAX_CONTEXT_KEYS, 10) || 10,
    maxContextValueChars: parseInt(process.env.AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS, 10) || 200,
  };
}

/**
 * Validate the request payload
 *
 * @param {object} payload - Request body
 * @returns {{ valid: boolean, error?: string, details?: object }}
 */
function validatePayload(payload) {
  const config = getConfig();

  // Prompt is required
  if (!payload || typeof payload.prompt !== "string") {
    return {
      valid: false,
      error: "prompt is required and must be a string",
      details: { field: "prompt" },
    };
  }

  // Prompt length check
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

  // Context validation (optional)
  if (payload.context !== undefined) {
    if (typeof payload.context !== "object" || payload.context === null) {
      return {
        valid: false,
        error: "context must be an object",
        details: { field: "context" },
      };
    }

    // currentSettings validation
    if (payload.context.currentSettings !== undefined) {
      const settings = payload.context.currentSettings;
      if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
        return {
          valid: false,
          error: "context.currentSettings must be an object",
          details: { field: "context.currentSettings" },
        };
      }

      const keys = Object.keys(settings);
      if (keys.length > config.maxContextKeys) {
        return {
          valid: false,
          error: `context.currentSettings exceeds maximum of ${config.maxContextKeys} keys`,
          details: { field: "context.currentSettings", maxKeys: config.maxContextKeys, actualKeys: keys.length },
        };
      }

      // Validate each value
      for (const key of keys) {
        const value = settings[key];
        if (value !== null && value !== undefined) {
          const strValue = String(value);
          if (strValue.length > config.maxContextValueChars) {
            return {
              valid: false,
              error: `context.currentSettings.${key} exceeds maximum length of ${config.maxContextValueChars} characters`,
              details: { field: `context.currentSettings.${key}`, maxLength: config.maxContextValueChars },
            };
          }
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Build the user message including context
 *
 * @param {string} prompt - User's question
 * @param {object} context - Optional context object
 * @returns {string}
 */
function buildUserMessage(prompt, context) {
  let message = prompt.trim();

  if (context?.currentSettings && Object.keys(context.currentSettings).length > 0) {
    const settingsStr = Object.entries(context.currentSettings)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    message += `\n\nCurrent settings:\n${settingsStr}`;
  }

  return message;
}

/**
 * Call OpenAI API
 *
 * @param {string} prompt - User prompt
 * @param {object} context - Optional context
 * @returns {Promise<{ success: boolean, data?: object, error?: object }>}
 */
async function callOpenAI(prompt, context) {
  const config = getConfig();
  const startTime = Date.now();

  // Check API key is configured
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

  // Build request
  const userMessage = buildUserMessage(prompt, context);
  const requestBody = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 500,
    temperature: 0.7,
  };

  // Create abort controller for timeout
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

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return mapProviderError(response.status, errorBody, latencyMs);
    }

    // Parse successful response
    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
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

    return {
      success: true,
      data: {
        response: assistantMessage.trim(),
        model: config.model,
      },
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    // Handle abort (timeout)
    if (err.name === "AbortError") {
      return {
        success: false,
        error: {
          code: ProviderErrorCodes.TIMEOUT,
          status: 504,
          message: "AI request timed out",
        },
        latencyMs,
      };
    }

    // Handle network errors
    return {
      success: false,
      error: {
        code: ProviderErrorCodes.NETWORK_ERROR,
        status: 502,
        message: "Failed to connect to AI provider",
      },
      latencyMs,
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
  // 401/403 from OpenAI = our API key is bad = server misconfiguration
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

  // 429 = rate limited by OpenAI
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

  // 400 = bad request (shouldn't happen if we validate, but handle gracefully)
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

  // 5xx = OpenAI server error
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

  // Unknown error
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
  validatePayload,
  callOpenAI,
  getConfig,
  // Exported for testing
  ProviderErrorCodes,
  buildUserMessage,
  mapProviderError,
};
