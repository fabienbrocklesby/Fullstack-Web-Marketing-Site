module.exports = ({ env }) => {
  const nodeEnv = env("NODE_ENV", "development");
  const envKeys = env.array("APP_KEYS");
  const keys =
    envKeys && envKeys.length > 0
      ? envKeys
      : nodeEnv === "production"
        ? []
        : ["devKeyA_change_me", "devKeyB_change_me"]; // dev fallback

  return {
    host: env("HOST", "0.0.0.0"),
    port: env.int("PORT", 1337),
    app: {
      keys,
    },
    webhooks: {
      populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
    },
  };
};
