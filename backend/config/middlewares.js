// Build CORS origin list dynamically based on environment
const isDevelopment = process.env.NODE_ENV !== "production";

// Development-only origins (localhost variants)
const devOrigins = isDevelopment
  ? [
      "http://localhost:4321",
      "http://127.0.0.1:4321",
      "http://localhost:4322",
      "http://127.0.0.1:4322",
    ]
  : [];

// Production/staging origins
const prodOrigins = [
  "https://lightlane.app",
  "https://www.lightlane.app",
  // Cloudflare Pages preview (pattern kept - note wildcard matching may require custom logic if needed)
  "https://*.pages.dev",
  // Explicit FRONTEND_URL env (can override localhost during staging)
  process.env.FRONTEND_URL,
  // Optional single custom origin via env
  process.env.PUBLIC_FRONTEND_ORIGIN,
  // Direct server access (only if you still reach it directly; safe to remove later)
  "http://209.38.91.37:4321",
].filter(Boolean);

const corsOrigins = [...devOrigins, ...prodOrigins];

const baseMiddlewares = [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  {
    name: "strapi::cors",
    config: {
      headers: "*",
      origin: corsOrigins,
      credentials: true, // Allow cookies/auth headers for authenticated requests
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  // Stripe raw body capture MUST come before strapi::body
  {
    name: "global::stripe-raw-body",
    config: {},
  },
  {
    name: "strapi::body",
    config: {
      parserOptions: {
        jsonLimit: "1mb",
      },
      // Preserve raw body for signature verification (used by webhook)
      includeUnparsed: true,
    },
  },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  // Rate limiting middlewares - configured in src/middlewares/rate-limit.js
  // These are used by routes that reference them explicitly
];

module.exports = isDevelopment
  ? [
      ...baseMiddlewares,
      {
        name: "global::dev-only",
        config: {},
      },
    ]
  : baseMiddlewares;
