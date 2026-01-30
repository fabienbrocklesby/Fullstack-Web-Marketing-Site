/**
 * Auth rate limiting middleware
 * Limits authentication endpoints (login, register) to 5 requests per minute per IP
 */
const { authRateLimit } = require('./rate-limit');

module.exports = (config, { strapi }) => {
  return authRateLimit;
};
