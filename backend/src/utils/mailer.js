/**
 * ZeptoMail SMTP mailer using nodemailer directly.
 * Configure via environment variables:
 *   SMTP_HOST=smtp.zeptomail.com.au
 *   SMTP_PORT=587 (or 465)
 *   SMTP_SECURE=false (true if 465)
 *   SMTP_USERNAME=emailapikey
 *   SMTP_PASSWORD=... (API key)
 *   EMAIL_FROM=noreply@lightlane.app
 */

const nodemailer = require("nodemailer");

let transporter; // lazy init
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.zeptomail.com.au",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: (process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function verify() {
  try {
    await getTransporter().verify();
    strapi?.log.info("📬 ZeptoMail SMTP verified");
  } catch (e) {
    strapi?.log.error("ZeptoMail SMTP verify failed", e);
  }
}

module.exports = {
  verify,
  /**
   * Send a basic email.
   * @param {Object} opts
   * @param {string|string[]} opts.to
   * @param {string} opts.subject
   * @param {string} [opts.html]
   * @param {string} [opts.text]
   * @param {string} [opts.from]
   */
  async sendBasic({ to, subject, html, text, from }) {
    if (!to) throw new Error("to required");
    if (!subject) throw new Error("subject required");
    if (!html && !text) throw new Error("html or text required");
    const mail = {
      from: from || process.env.EMAIL_FROM || "noreply@lightlane.app",
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    };
    try {
      const info = await getTransporter().sendMail(mail);
      if (typeof strapi !== "undefined") {
        strapi.log.info(
          `📧 Sent mail to ${to} subject=\"${subject}\" id=${info.messageId}`,
        );
      } else {
        console.log(
          `📧 Sent mail to ${to} subject=\"${subject}\" id=${info.messageId}`,
        );
      }
      return { success: true, id: info.messageId };
    } catch (e) {
      if (typeof strapi !== "undefined")
        strapi.log.error("Email send failed", e);
      else console.error("Email send failed", e);
      return { success: false, error: e.message };
    }
  },
};
