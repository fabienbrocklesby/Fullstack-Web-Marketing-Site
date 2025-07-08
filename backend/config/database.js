module.exports = ({ env }) => {
  // Use SQLite for local development with in-memory fallback
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: env('DATABASE_FILENAME', ':memory:'),
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
      },
    },
  };
};
