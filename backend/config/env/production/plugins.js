module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "local",
      providerOptions: {
        sizeLimit: 100000000, // 100MB
      },
    },
  },
  // Email overridden here only if you need different prod values (inherits from root otherwise)
  email: {
    config: {
      provider: "smtp",
      providerOptions: {
        host: env("SMTP_HOST", "smtp.zeptomail.com.au"),
        port: env.int("SMTP_PORT", 587),
        secure: env.bool("SMTP_SECURE", false),
        auth: {
          user: env("SMTP_USERNAME"),
          pass: env("SMTP_PASSWORD"),
        },
      },
      settings: {
        defaultFrom: env("EMAIL_FROM", "noreply@lightlane.app"),
        defaultReplyTo: env("EMAIL_REPLY_TO", "support@lightlane.app"),
        defaultSubject: "Lightlane Notification",
      },
    },
  },
});
