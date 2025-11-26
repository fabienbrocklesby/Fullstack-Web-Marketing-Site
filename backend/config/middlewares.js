// Build CORS origin list dynamically and filter out falsy values.
const corsOrigins = [
  // Local development
  "http://localhost:4321",
  "http://localhost:4322",
  // Production domains
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

module.exports = [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  {
    name: "strapi::cors",
    config: {
      headers: "*",
      origin: corsOrigins,
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      parserOptions: {
        jsonLimit: "1mb",
      },
    },
  },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  // Debug middleware disabled to prevent console spam
  // {
  //   name: 'global::auth-debug',
  //   config: {},
  // },
];
