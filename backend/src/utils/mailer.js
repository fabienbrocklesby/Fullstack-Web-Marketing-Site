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
// Remote SVG logo URL (trusted CDN)
const REMOTE_LOGO_URL =
  process.env.BRANDING_LOGO_URL ||
  "https://publicassets.lightlane.app/LogoHorizontal.svg";

let transporter; // lazy init
const API_TRANSPORT_ENABLED =
  (process.env.MAIL_TRANSPORT || "").toLowerCase() === "api" ||
  !!process.env.ZEPTOMAIL_API_KEY ||
  !!process.env.ZEPTO_API_KEY;

/**
 * Send via ZeptoMail HTTP API instead of SMTP
 * Env:
 *   ZEPTOMAIL_API_KEY or ZEPTO_API_KEY (authorization token)
 *   ZEPTO_API_BASE (default https://api.zeptomail.com.au)
 */
async function sendViaApi({ to, subject, html, text, from, replyTo }) {
  const apiKey =
    process.env.ZEPTOMAIL_API_KEY || process.env.ZEPTO_API_KEY || "";
  if (!apiKey) throw new Error("Missing ZEPTOMAIL_API_KEY for API mail");
  const base = process.env.ZEPTO_API_BASE || "https://api.zeptomail.com.au";
  const endpoint = base.replace(/\/$/, "") + "/v1.1/email";
  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    from: {
      address: from || process.env.EMAIL_FROM || "noreply@lightlane.app",
    },
    to: recipients.map((r) => ({ email_address: { address: r } })),
    subject,
    ...(html ? { htmlbody: html } : {}),
    ...(text ? { textbody: text } : {}),
  };
  if (replyTo) payload.reply_to = { address: replyTo };
  const tStart = Date.now();
  try {
    if (typeof strapi !== "undefined")
      strapi.log.info(
        `🌐 (API) Sending mail to ${recipients.join(",")} subject="${subject}" endpoint=${endpoint}`,
      );
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.message || json.error || res.statusText;
      throw new Error(`API ${res.status} ${msg}`);
    }
    const messageId =
      json.data?.message_id || json.messageId || json.request_id || "api-mail";
    if (typeof strapi !== "undefined") {
      strapi.log.info(
        `📧 (API) Sent mail to ${recipients.join(",")} subject="${subject}" id=${messageId}`,
      );
      strapi.log.info(
        `⏱️ (API) Mail send duration ${Date.now() - tStart}ms to=${recipients.join(",")}`,
      );
    }
    return { success: true, id: messageId, transport: "api" };
  } catch (e) {
    if (typeof strapi !== "undefined")
      strapi.log.error(
        `Email send failed (API) to=${recipients.join(",")} subject="${subject}" err=${e.message}`,
      );
    return { success: false, error: e.message, transport: "api" };
  }
}
function getTransporter() {
  if (!transporter) {
    const enableDebug = (process.env.MAIL_DEBUG || "false") === "true";
    const host = process.env.SMTP_HOST || "smtp.zeptomail.com.au";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = (process.env.SMTP_SECURE || "false") === "true";
    const user = process.env.SMTP_USERNAME;
    const passPresent = !!process.env.SMTP_PASSWORD;
    // Optional fine‑grained timeout / TLS controls (can be set via env)
    const connectionTimeout = parseInt(
      process.env.SMTP_CONN_TIMEOUT_MS || "10000",
      10,
    ); // time to establish socket
    const greetingTimeout = parseInt(
      process.env.SMTP_GREETING_TIMEOUT_MS || "10000",
      10,
    ); // time waiting for initial greeting
    const socketTimeout = parseInt(
      process.env.SMTP_SOCKET_TIMEOUT_MS || "20000",
      10,
    ); // inactivity timeout during data transfer
    const requireTLS = (process.env.SMTP_REQUIRE_TLS || "false") === "true";
    const tlsMinVersion = process.env.SMTP_TLS_MIN_VERSION || undefined; // e.g. 'TLSv1.2'
    const forceIPv4 = (process.env.SMTP_FORCE_IPV4 || "false") === "true";
    if (typeof strapi !== "undefined") {
      strapi.log.info(
        `📮 Initialising SMTP transporter host=${host} port=${port} secure=${secure} user=${user} debug=${enableDebug} connTimeout=${connectionTimeout}ms greetTimeout=${greetingTimeout}ms socketTimeout=${socketTimeout}ms requireTLS=${requireTLS}`,
      );
    } else {
      console.log(
        `📮 Initialising SMTP transporter host=${host} port=${port} secure=${secure} user=${user} debug=${enableDebug} connTimeout=${connectionTimeout}ms greetTimeout=${greetingTimeout}ms socketTimeout=${socketTimeout}ms requireTLS=${requireTLS}`,
      );
    }
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: process.env.SMTP_PASSWORD },
      logger: enableDebug,
      debug: enableDebug,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      requireTLS,
      tls: tlsMinVersion ? { minVersion: tlsMinVersion } : undefined,
      family: forceIPv4 ? 4 : undefined,
    });

    // Attach diagnostic listeners
    try {
      transporter.on?.("error", (err) => {
        if (typeof strapi !== "undefined")
          strapi.log.error(
            `SMTP transporter error stage=runtime err=${err.message}`,
          );
        else console.error("SMTP transporter error", err);
      });
      transporter.on?.("log", (log) => {
        if (!enableDebug) return; // only emit when debug true
        const msg = `[SMTP:${log.type}] ${log.message || ""}`;
        if (typeof strapi !== "undefined") strapi.log.info(msg);
        else console.log(msg);
      });
    } catch (_) { }
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
   * Build a simple branded HTML layout
   */
  async _wrapHtml({
    title = "",
    body = "",
    includeSignature = false,
    raw = false,
  }) {
    const brandBlock = `<div style=\"display:flex;align-items:center;gap:12px;\"><img src=\"${REMOTE_LOGO_URL}\" alt=\"Light Lane\" style=\"max-width:600px;width:260px;height:auto;display:block;\"/></div>`;
    const signature = includeSignature
      ? `<tr><td style="padding:24px 32px 8px 32px;font-family:Inter,Arial,sans-serif;font-size:14px;color:#444;line-height:1.5">
            <p style="margin:0 0 16px 0;">Regards,</p>
            <p style="margin:0 0 12px 0;font-weight:500;">Fabien Brocklesby<br/>
              <span style="font-weight:400;">CEO & Founder - Light Lane</span><br/>
              <a href="mailto:fabien@lightlane.app" style="color:#4f46e5;text-decoration:none">fabien@lightlane.app</a>
            </p>
            <div style="margin-top:8px;">${brandBlock}</div>
         </td></tr>`
      : "";
    if (raw) return body + signature; // allow caller full control
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
      <style>@media (prefers-color-scheme:dark){body{background:#0d0d12!important;color:#e5e7eb!important}}</style>
      </head><body style="margin:0;padding:0;background:#f5f6fa;font-family:Inter,Arial,sans-serif;color:#111;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
              <tr>
                <td style="padding:28px 32px 8px 32px;text-align:left;">
                  ${brandBlock}
                </td>
              </tr>
              ${title ? `<tr><td style="padding:8px 32px 0 32px;font-size:22px;font-weight:600;font-family:Inter,Arial,sans-serif;">${title}</td></tr>` : ""}
              <tr>
                <td style="padding:16px 32px 8px 32px;font-size:15px;line-height:1.55;">${body}</td>
              </tr>
              ${signature}
              <tr><td style="padding:28px 32px 24px 32px;font-size:12px;color:#6b7280;border-top:1px solid #eef0f4;">© ${new Date().getFullYear()} Light Lane. All rights reserved.</td></tr>
            </table>
            <div style="font-size:11px;color:#9ca3af;margin-top:12px;max-width:620px;">You are receiving this because you interacted with Light Lane.</div>
          </td>
        </tr>
      </table>
    </body></html>`;
  },
  /**
   * Higher-level templated send.
   * opts: { to, subject, heading, intro, paragraphs[], cta:{label,url}, includeSignature, rawHtml, replyTo }
   */
  async sendTemplate(opts) {
    const {
      to,
      subject,
      heading = "",
      intro = "",
      paragraphs = [],
      cta,
      includeSignature = false,
      rawHtml,
      from,
      replyTo,
    } = opts;
    let body = "";
    if (rawHtml) body = rawHtml;
    else {
      if (intro) body += `<p style="margin:0 0 16px 0;">${intro}</p>`;
      for (const p of paragraphs)
        body += `<p style="margin:0 0 16px 0;">${p}</p>`;
      if (cta && cta.url) {
        body += `<p style=\"margin:24px 0 8px 0;\"><a href="${cta.url}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block;font-size:14px;font-family:Inter,Arial,sans-serif;">${cta.label || "Open"}</a></p>`;
        body += `<p style="margin:0 0 16px 0;font-size:12px;color:#6b7280;">If the button does not work, copy & paste this URL: <br/><span style="word-break:break-all;">${cta.url}</span></p>`;
      }
    }
    const html = await this._wrapHtml({
      title: heading || subject,
      body,
      includeSignature,
    });
    return this.sendBasic({ to, subject, html, from, replyTo });
  },
  /**
   * Send a basic email.
   * @param {Object} opts
   * @param {string|string[]} opts.to
   * @param {string} opts.subject
   * @param {string} [opts.html]
   * @param {string} [opts.text]
   * @param {string} [opts.from]
   * @param {string} [opts.replyTo]
   */
  async sendBasic({ to, subject, html, text, from, replyTo }) {
    if (!to) throw new Error("to required");
    if (!subject) throw new Error("subject required");
    if (!html && !text) throw new Error("html or text required");
    // API-first path with SMTP fallback
    if (API_TRANSPORT_ENABLED) {
      if (typeof strapi !== "undefined")
        strapi.log.info(
          `🔀 Mail transport preference: API first (ZEPTOMAIL_API_KEY present=$${!!process
            .env
            .ZEPTOMAIL_API_KEY} MAIL_TRANSPORT=${(process.env.MAIL_TRANSPORT || "").toLowerCase()})`,
        );
      const apiResult = await sendViaApi({
        to,
        subject,
        html,
        text,
        from,
        replyTo,
      });
      if (apiResult.success) return apiResult;
      const canFallbackSMTP =
        process.env.SMTP_USERNAME &&
        process.env.SMTP_PASSWORD &&
        (process.env.MAIL_DISABLE_SMTP_FALLBACK || "false") !== "true";
      if (canFallbackSMTP) {
        if (typeof strapi !== "undefined")
          strapi.log.warn(
            `📨 API email failed (err=${apiResult.error}); attempting SMTP fallback`,
          );
        // continue to SMTP build below
      } else {
        if (typeof strapi !== "undefined")
          strapi.log.error(
            `❌ API email failed with no SMTP fallback available err=${apiResult.error}`,
          );
        return apiResult; // no fallback available
      }
    }
    const mail = {
      from: from || process.env.EMAIL_FROM || "noreply@lightlane.app",
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo:
        replyTo ||
        process.env.DEFAULT_REPLY_TO ||
        process.env.EMAIL_REPLY_TO ||
        undefined,
    };
    try {
      const tStart = Date.now();
      if (typeof strapi !== "undefined")
        strapi.log.info(
          `📤 Sending mail to ${to} subject="${subject}" (timeout=${process.env.MAIL_TIMEOUT_MS || 15000
          }ms)`,
        );
      const timeoutMs = parseInt(process.env.MAIL_TIMEOUT_MS || "15000", 10);
      const sendPromise = getTransporter().sendMail(mail);
      const result = await Promise.race([
        sendPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SMTP_SEND_TIMEOUT")), timeoutMs),
        ),
      ]);
      const info = result; // if not timeout
      if (typeof strapi !== "undefined") {
        strapi.log.info(
          `📧 Sent mail to ${to} subject=\"${subject}\" id=${info.messageId}`,
        );
      } else {
        console.log(
          `📧 Sent mail to ${to} subject=\"${subject}\" id=${info.messageId}`,
        );
      }
      if (typeof strapi !== "undefined")
        strapi.log.info(
          `⏱️ Mail send duration ${Date.now() - tStart}ms to=${to}`,
        );
      return { success: true, id: info.messageId };
    } catch (e) {
      if (typeof strapi !== "undefined")
        strapi.log.error(
          `Email send failed to=${to} subject=\"${subject}\" err=${e.message}`,
        );
      else console.error("Email send failed", e);
      return { success: false, error: e.message };
    }
  },
};
