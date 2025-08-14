const mailer = require("../../../utils/mailer");

module.exports = {
  async create(ctx) {
    const body = ctx.request.body || {};
    const fullName = (body.fullName || body.name || "").trim();
    const email = (body.email || "").trim();
    const subject = (body.subject || body.useCase || "").trim();
    const message = (body.message || body.notes || "").trim();
    if (!fullName || !email || !message) {
      return ctx.badRequest("fullName, email, message required");
    }
    const data = {
      fullName,
      email,
      subject,
      message,
      source: body.source || ctx.request.header["referer"] || "",
      metadata: { ip: ctx.request.ip, ua: ctx.request.header["user-agent"] },
    };

    const record = await strapi.entityService.create(
      "api::contact-message.contact-message",
      { data },
    );

    const supportRecipient =
      process.env.SUPPORT_EMAIL || "support@lightlane.app";
    const promises = [];
    const verbose = (process.env.MAIL_LOG_VERBOSE || "false") === "true";
    if (verbose)
      strapi.log.info(
        `[contact-message] Preparing emails for record ${record.id}`,
      );

    // Support team notification
    promises.push(
      mailer
        .sendTemplate({
          to: supportRecipient,
          subject: `Support Message: ${fullName}`,
          heading: "New Contact Message",
          intro: `${fullName} just sent a support / contact message.`,
          paragraphs: [
            `<strong>Name:</strong> ${fullName}`,
            `<strong>Email:</strong> ${email}`,
            subject ? `<strong>Subject:</strong> ${subject}` : null,
            `<strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}`,
            `<strong>Record ID:</strong> ${record.id}`,
          ].filter(Boolean),
        })
        .then((r) => {
          if (verbose)
            strapi.log.info(
              `[contact-message] Support email result success=${r.success}`,
            );
          return r;
        }),
    );

    // Customer confirmation
    promises.push(
      mailer
        .sendTemplate({
          to: email,
          subject: "We received your message",
          heading: "Message received",
          intro: `Hi ${fullName.split(" ")[0]}, thanks for reaching out to Light Lane.`,
          paragraphs: [
            "We've logged your message and will reply as soon as possible.",
            "If you have extra details, just reply to this email – it goes straight to the support team.",
          ],
          includeSignature: true,
          replyTo: supportRecipient,
        })
        .then((r) => {
          if (verbose)
            strapi.log.info(
              `[contact-message] Customer confirmation email result success=${r.success}`,
            );
          return r;
        }),
    );

    Promise.allSettled(promises).then((r) => {
      const failed = r.filter(
        (x) => x.status === "fulfilled" && x.value?.success === false,
      );
      if (failed.length)
        strapi.log.warn(
          `Some contact message emails failed count=${failed.length}`,
        );
      if (verbose) strapi.log.info(`[contact-message] Email promises settled`);
    });

    ctx.body = { id: record.id };
  },
};
