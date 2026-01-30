module.exports = ({ env }) => {
  const client = env("DATABASE_CLIENT", "sqlite");

  // PostgreSQL configuration for production
  if (client === "postgres") {
    return {
      connection: {
        client: "postgres",
        connection: {
          host: env("DATABASE_HOST", "localhost"),
          port: env.int("DATABASE_PORT", 5432),
          database: env("DATABASE_NAME", env("DB_NAME", "strapi")),
          user: env("DATABASE_USER", env("DB_USER", "strapi")),
          password: env("DATABASE_PASSWORD", env("DB_PASSWORD", "strapi")),
          ssl: env.bool("DATABASE_SSL", false) && {
            rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", true),
          },
        },
        debug: false,
        pool: {
          min: env.int("DATABASE_POOL_MIN", 2),
          max: env.int("DATABASE_POOL_MAX", 10),
        },
      },
    };
  }

  // SQLite for local development with in-memory fallback
  return {
    connection: {
      client: "sqlite",
      connection: {
        filename: env("DATABASE_FILENAME", ":memory:"),
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
      },
    },
  };
};
