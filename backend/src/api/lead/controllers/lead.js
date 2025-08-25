"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::lead.lead", ({ strapi }) => ({
  async claim(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user && ctx.state.user.id;
    if (!userId) {
      return ctx.unauthorized("Must be logged in to claim lead");
    }
    const lead = await strapi.entityService.update("api::lead.lead", id, {
      data: { assignedTo: userId },
      populate: ["assignedTo"],
    });
    ctx.body = lead;
  },

  async addEmailCommunication(ctx) {
    const { email, subject, content } = ctx.request.body || {};
    if (!email) {
      return ctx.badRequest("Email is required");
    }
    const lead = await strapi.db.query("api::lead.lead").findOne({
      where: { email },
    });
    if (!lead) {
      return ctx.notFound("Lead not found");
    }
    const communication = await strapi.entityService.create(
      "api::communication.communication",
      {
        data: {
          lead: lead.id,
          type: "email",
          subject,
          content,
          timestamp: new Date(),
        },
      },
    );
    ctx.body = communication;
  },
}));
