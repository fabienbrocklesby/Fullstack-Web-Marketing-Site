// Global (all environments) plugin configuration
// ZeptoMail SMTP integration via Strapi email plugin/provider
// Ensure you set the environment variables (see README snippet below) and DO NOT commit secrets.

module.exports = ({ env }) => ({
  // Using custom nodemailer utility (see src/utils/mailer.js) rather than a Strapi provider package.
});
