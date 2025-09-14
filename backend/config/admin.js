module.exports = ({ env }) => {
  const isProd = env("NODE_ENV") === "production";
  const adminJwt =
    env("ADMIN_JWT_SECRET") ||
    (isProd ? undefined : "dev_admin_jwt_secret_change_me");
  const apiTokenSalt =
    env("API_TOKEN_SALT") ||
    (isProd ? undefined : "dev_api_token_salt_change_me");
  const transferTokenSalt =
    env("TRANSFER_TOKEN_SALT") ||
    (isProd ? undefined : "dev_transfer_token_salt_change_me");

  return {
    auth: {
      secret: adminJwt,
    },
    apiToken: {
      salt: apiTokenSalt,
    },
    transfer: {
      token: {
        salt: transferTokenSalt,
      },
    },
    flags: {
      nps: env.bool("FLAG_NPS", true),
      promoteEE: env.bool("FLAG_PROMOTE_EE", true),
    },
  };
};
