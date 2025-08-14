module.exports = [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  {
    name: "strapi::cors",
    config: {
      headers: "*",
      origin: [
        "http://localhost:4321",
        "http://localhost:4322",
        "https://*.pages.dev",
        process.env.FRONTEND_URL || "http://localhost:4321",
        // Production frontend (IP + port)
        "http://209.38.91.37:4000",
        // Allow setting a single explicit origin via env (overrides if provided)
        process.env.PUBLIC_FRONTEND_ORIGIN || undefined,
      ],
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
