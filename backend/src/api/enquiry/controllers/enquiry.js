const mailer = require("../../../utils/mailer");

module.exports = {
  async create(ctx) {
    const body = ctx.request.body;
    const data = {
      fullName: body.fullName,
      email: body.email,
      company: body.company || "",
      useCase: body.useCase || "",
      planInterested: body.planInterested || "",
      affiliateCode: body.affiliateCode || ctx.cookies.get("aff") || "",
      source: body.source || ctx.request.header["referer"] || "",
      metadata: { ip: ctx.request.ip, ua: ctx.request.header["user-agent"] },
    };
    if (!data.fullName || !data.email) {
      return ctx.badRequest("fullName and email required");
    }
    const enquiry = await strapi.entityService.create("api::enquiry.enquiry", {
      data,
    });
    // Create lead record
    let leadId = null;
    try {
      const lead = await strapi.entityService.create("api::lead.lead", {
        data: { ...data, enquiry: enquiry.id },
      });
      leadId = lead.id;
    } catch (e) {
      strapi.log.error("Lead create failed", e);
    }

    // Fire journey tracking (non-blocking)
    try {
      await strapi
        .service("api::journey-tracker.journey-tracker")
        ?.track("enquiry_submitted", {
          affiliateCode: data.affiliateCode,
          planInterested: data.planInterested,
        });
    } catch (e) {
      strapi.log.warn("journey track failed", e);
    }

    // Send notification emails (non-fatal if fail)
    const adminRecipient =
      process.env.ENQUIRY_ADMIN_EMAIL || "admin@lightlane.app";
    const promises = [];
    // Admin notification (rich)
    promises.push(
      mailer.sendTemplate({
        to: adminRecipient,
        subject: `New Enquiry: ${data.fullName}`,
        heading: "New Enquiry Received",
        intro: `${data.fullName} just submitted an enquiry.`,
        paragraphs: [
          `<strong>Name:</strong> ${data.fullName}`,
          `<strong>Email:</strong> ${data.email}`,
          `<strong>Company:</strong> ${data.company || "-"}`,
          `<strong>Use Case:</strong> ${data.useCase || "-"}`,
          `<strong>Plan Interested:</strong> ${data.planInterested || "-"}`,
          `<strong>Affiliate Code:</strong> ${data.affiliateCode || "-"}`,
          `<strong>Source:</strong> ${data.source || "-"}`,
          `<strong>Lead ID:</strong> ${leadId || "-"}`,
          `<strong>Enquiry ID:</strong> ${enquiry.id}`,
        ],
      }),
    );
    // Sales notification (rich)
    const salesRecipient = process.env.SALES_EMAIL || "sales@lightlane.app";
    promises.push(
      mailer.sendTemplate({
        to: salesRecipient,
        subject: `New Lead: ${data.fullName}`,
        heading: "New Lead Captured",
        intro: "A prospect just raised their hand.",
        paragraphs: [
          `<strong>Name:</strong> ${data.fullName}`,
          `<strong>Email:</strong> ${data.email}`,
          `<strong>Company:</strong> ${data.company || "-"}`,
          `<strong>Plan:</strong> ${data.planInterested || "-"}`,
          `<strong>Affiliate:</strong> ${data.affiliateCode || "-"}`,
          `<strong>Lead ID:</strong> ${leadId || "-"}`,
          `<strong>Enquiry ID:</strong> ${enquiry.id}`,
        ],
      }),
    );
    // Customer confirmation (with signature)
    promises.push(
      mailer.sendTemplate({
        to: data.email,
        subject: "We received your enquiry",
        heading: "Thanks - we got it!",
        intro: `Hi ${data.fullName.split(" ")[0]}, thanks for your interest in Light Lane.`,
        paragraphs: [
          data.planInterested
            ? `You asked about the <strong>${data.planInterested}</strong> plan - we\'ll review and follow up soon.`
            : `We\'ll review your details and be in touch shortly.`,
          "In the meantime you can reply directly to this email if you have any extra context you'd like to share.",
        ],
        includeSignature: true,
        replyTo: process.env.SALES_EMAIL || "sales@lightlane.app",
      }),
    );
    Promise.allSettled(promises).then((r) => {
      const failed = r.filter(
        (x) => x.status === "fulfilled" && x.value?.success === false,
      );
      if (failed.length) strapi.log.warn("Some enquiry emails failed");
    });

    ctx.body = { id: enquiry.id };
  },
};
