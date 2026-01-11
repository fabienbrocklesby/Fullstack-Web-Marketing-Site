/**
 * License rate limiting middleware
 * Limits license activation/deactivation to 10 requests per minute per IP
 */
const { licenseRateLimit } = require('./rate-limit');

module.exports = (config, { strapi }) => {
  return licenseRateLimit;
};
