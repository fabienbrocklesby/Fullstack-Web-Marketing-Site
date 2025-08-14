const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enquiry.enquiry", ({ strapi }) => ({
  async create(ctx) {
    const { fullName, email, company, useCase, planInterested, affiliateCode, source } = ctx.request.body;
    if (!fullName || !email) return ctx.badRequest("fullName and email required");
    const enquiry = await strapi.entityService.create("api::enquiry.enquiry", {
      data: {
        fullName,
        email: email.toLowerCase(),
        company,
        useCase,
        planInterested,
        affiliateCode,
        source,
        status: "new",
      },
    });
    ctx.body = { enquiry };
  },
}));
