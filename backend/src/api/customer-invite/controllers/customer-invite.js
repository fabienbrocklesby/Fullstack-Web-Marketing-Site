const crypto = require("crypto");
const mailer = require("../../../utils/mailer");
function genCode() {
  return crypto.randomBytes(4).toString("hex");
}
module.exports = {
  async issue(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const { email, affiliateCode, enquiryId, expiresAt } = ctx.request.body;
    if (!email) return ctx.badRequest("email required");
    let affiliate = null;
    if (affiliateCode) {
      const list = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        { filters: { code: affiliateCode } },
      );
      affiliate = list[0];
    }
    const code = genCode();
    const invite = await strapi.entityService.create(
      "api::customer-invite.customer-invite",
      {
        data: {
          code,
          issuedToEmail: email,
          affiliate: affiliate ? affiliate.id : null,
          enquiry: enquiryId || null,
          expiresAt: expiresAt || null,
        },
      },
    );
    try {
      await strapi
        .service("api::journey-tracker.journey-tracker")
        ?.track("invite_issued", { code, email });
    } catch (e) { }
    const joinUrl = `${process.env.PUBLIC_SITE_URL || ""}/join?code=${code}`;
    // Send invite email (non-blocking)
    mailer.sendTemplate({
      to: email,
      subject: "Your invite to Light Lane",
      heading: "You're Invited",
      intro: `You now have early access to Light Lane.`,
      paragraphs: [
        `Use the invite code below or simply click the button to continue your onboarding.`,
        `Invite Code: <strong>${code}</strong>`,
      ],
      cta: { label: "Accept Invite", url: joinUrl },
      includeSignature: true,
      replyTo: process.env.SALES_EMAIL || "sales@lightlane.app",
    });
    ctx.body = { code, joinUrl };
  },
  async validate(ctx) {
    const { code } = ctx.request.query;
    if (!code) return ctx.badRequest("code required");
    const list = await strapi.entityService.findMany(
      "api::customer-invite.customer-invite",
      { filters: { code } },
    );
    if (!list.length) return (ctx.body = { valid: false });
    const invite = list[0];
    const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
    if (expired || invite.status !== "pending" || invite.uses >= invite.maxUses)
      return (ctx.body = { valid: false });
    ctx.body = { valid: true, email: invite.issuedToEmail };
  },
  async redeem(ctx) {
    const { code, email, password, firstName, lastName } = ctx.request.body;
    if (!code || !email || !password || !firstName || !lastName)
      return ctx.badRequest("missing fields");
    const list = await strapi.entityService.findMany(
      "api::customer-invite.customer-invite",
      { filters: { code }, populate: ["enquiry", "affiliate"] },
    );
    if (!list.length) return ctx.badRequest("invalid code");
    const invite = list[0];
    const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
    if (expired || invite.status !== "pending" || invite.uses >= invite.maxUses)
      return ctx.badRequest("code unusable");
    const existingCustomers = await strapi.entityService.findMany(
      "api::customer.customer",
      { filters: { email } },
    );
    let customer = existingCustomers[0];
    if (!customer) {
      customer = await strapi.entityService.create("api::customer.customer", {
        data: {
          email,
          firstName,
          lastName,
          password,
          affiliateCodeAtSignup:
            invite.affiliate?.code || invite.enquiry?.affiliateCode || "",
          originEnquiryId: invite.enquiry ? invite.enquiry.id : null,
          metadata: { inviteCode: code },
        },
      });
    }
    await strapi.entityService.update(
      "api::customer-invite.customer-invite",
      invite.id,
      {
        data: {
          uses: invite.uses + 1,
          status: invite.uses + 1 >= invite.maxUses ? "redeemed" : "pending",
          redeemedAt: new Date(),
        },
      },
    );
    if (invite.enquiry) {
      await strapi.entityService.update(
        "api::enquiry.enquiry",
        invite.enquiry.id,
        { data: { status: "invited" } },
      );
    }
    // Send welcome email
    mailer.sendTemplate({
      to: email,
      subject: "Welcome to Light Lane",
      heading: "Welcome aboard",
      intro: `Hi ${firstName}, your account is live.`,
      paragraphs: [
        "You can now explore the dashboard and start configuring your environment.",
        "If you have any questions just hit reply - I read everything.",
      ],
      cta: {
        label: "Open Dashboard",
        url: `${process.env.PUBLIC_SITE_URL || ""}/dashboard`,
      },
      includeSignature: true,
      replyTo: process.env.SALES_EMAIL || "sales@lightlane.app",
    });
    try {
      await strapi
        .service("api::journey-tracker.journey-tracker")
        ?.track("invite_redeemed", { code });
    } catch (e) { }
    ctx.body = { customerId: customer.id };
  },
};
