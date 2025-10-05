/**
 * Strapi API Configuration
 * 
 * This module exports the Strapi URL for use across the frontend.
 * In production, PUBLIC_STRAPI_URL should be set via environment variables.
 * Falls back to localhost for local development.
 */

// @ts-ignore - Astro injects env at build time
const rawUrl = import.meta.env?.PUBLIC_STRAPI_URL;

export const STRAPI_URL = rawUrl.replace(/\/$/, "");
export const STRAPI_API_URL = `${STRAPI_URL}/api`;
