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
    // Admin notification
    promises.push(
      mailer.sendBasic({
        to: adminRecipient,
        subject: `New Enquiry: ${data.fullName}`,
        html: `<p><strong>Name:</strong> ${data.fullName}</p>
             <p><strong>Email:</strong> ${data.email}</p>
             <p><strong>Company:</strong> ${data.company || "-"}</p>
             <p><strong>Use Case:</strong> ${data.useCase || "-"}</p>
             <p><strong>Plan Interested:</strong> ${data.planInterested || "-"}</p>
             <p><strong>Affiliate Code:</strong> ${data.affiliateCode || "-"}</p>
             <p><strong>Source:</strong> ${data.source || "-"}</p>`,
      }),
    );
    // Sales notification
    const salesRecipient = process.env.SALES_EMAIL || "sales@lightlane.app";
    promises.push(
      mailer.sendBasic({
        to: salesRecipient,
        subject: `New Lead: ${data.fullName}`,
        html: `<p>A new lead has been captured.</p>
             <p><strong>Name:</strong> ${data.fullName}<br/>
             <strong>Email:</strong> ${data.email}<br/>
             <strong>Company:</strong> ${data.company || "-"}<br/>
             <strong>Plan:</strong> ${data.planInterested || "-"}<br/>
             <strong>Affiliate:</strong> ${data.affiliateCode || "-"}<br/>
             <strong>Lead ID:</strong> ${leadId || "-"}<br/>
             <strong>Enquiry ID:</strong> ${enquiry.id}</p>`,
      }),
    );
    // Customer confirmation (simple)
    promises.push(
      mailer.sendBasic({
        to: data.email,
        subject: "We received your enquiry",
        html: `<p>Hi ${data.fullName.split(" ")[0]},</p><p>Thanks for reaching out. We received your enquiry about <strong>${data.planInterested || "Lightlane"}</strong>.</p><p>We'll get back to you shortly.</p>`,
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
