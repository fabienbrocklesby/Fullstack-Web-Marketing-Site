const { createCoreController } = require("@strapi/strapi").factories;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");

module.exports = createCoreController("api::customer-invite.customer-invite", ({ strapi }) => ({
  async issue(ctx) {
    if (!ctx.state.user) return ctx.unauthorized("Unauthorized");
    const { email, affiliateCode, enquiryId, expiresAt } = ctx.request.body;
    if (!email) return ctx.badRequest("email required");
    let affiliateId;
    if (affiliateCode) {
      const affiliates = await strapi.entityService.findMany("api::affiliate.affiliate", {
        filters: { code: affiliateCode },
      });
      if (affiliates.length) affiliateId = affiliates[0].id;
    }
    const code = randomBytes(5).toString("hex");
    const invite = await strapi.entityService.create("api::customer-invite.customer-invite", {
      data: {
        code,
        issuedToEmail: email.toLowerCase(),
        affiliate: affiliateId,
        enquiry: enquiryId,
        expiresAt,
        status: "pending",
      },
    });
    const joinUrl = `${process.env.FRONTEND_URL || ""}/join?code=${code}`;
    ctx.body = { code, joinUrl, id: invite.id };
  },

  async validate(ctx) {
    const { code } = ctx.request.query;
    if (!code) return (ctx.body = { valid: false });
    const invites = await strapi.entityService.findMany("api::customer-invite.customer-invite", {
      filters: { code },
      populate: { affiliate: true, enquiry: true },
    });
    if (invites.length === 0) return (ctx.body = { valid: false });
    const invite = invites[0];
    const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
    const valid = invite.status === "pending" && !expired && invite.uses < invite.maxUses;
    ctx.body = { valid };
  },

  async redeem(ctx) {
    const { code, email, password, firstName, lastName } = ctx.request.body;
    if (!code || !email || !password || !firstName || !lastName)
      return ctx.badRequest("missing fields");
    const invites = await strapi.entityService.findMany("api::customer-invite.customer-invite", {
      filters: { code },
      populate: { affiliate: true, enquiry: true },
    });
    if (invites.length === 0) return ctx.badRequest("Invalid code");
    const invite = invites[0];
    const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
    if (invite.status !== "pending" || expired || invite.uses >= invite.maxUses)
      return ctx.badRequest("Code not valid");
    const existing = await strapi.entityService.findMany("api::customer.customer", {
      filters: { email: email.toLowerCase() },
    });
    if (existing.length > 0) return ctx.badRequest("Email already used");
    const hashedPassword = await bcrypt.hash(password, 12);
    const customer = await strapi.entityService.create("api::customer.customer", {
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        metadata: {
          affiliateCodeAtSignup: invite.affiliate ? invite.affiliate.code : null,
          originEnquiryId: invite.enquiry ? invite.enquiry.id : null,
        },
      },
    });
    await strapi.entityService.update("api::customer-invite.customer-invite", invite.id, {
      data: {
        uses: invite.uses + 1,
        status: invite.uses + 1 >= invite.maxUses ? "redeemed" : "pending",
        redeemedAt: new Date(),
        customer: customer.id,
      },
    });
    const token = jwt.sign(
      { id: customer.id, email: customer.email, type: "customer" },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "7d" },
    );
    const { password: _, ...customerData } = customer;
    ctx.body = { customer: customerData, token };
  },
}));
