'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async find(ctx) {
    // Ensure user relations are populated with safe fields
    const existing = ctx.query?.populate;
    const ensure = {
      addedBy: { fields: ['username', 'email'] },
      claimedBy: { fields: ['username', 'email'] },
    };
    let mergedPopulate = ensure;
    if (existing) {
      if (existing === '*') {
        // Keep *, but also explicitly ensure user fields
        mergedPopulate = { '*': true, ...ensure };
      } else if (typeof existing === 'object') {
        mergedPopulate = { ...existing, ...ensure };
      }
    }
    ctx.query = { ...ctx.query, populate: mergedPopulate };
    return await super.find(ctx);
  },

  async findOne(ctx) {
    // Ensure user relations are populated with safe fields on single fetch
    const existing = ctx.query?.populate;
    const ensure = {
      addedBy: { fields: ['username', 'email'] },
      claimedBy: { fields: ['username', 'email'] },
    };
    let mergedPopulate = ensure;
    if (existing) {
      if (existing === '*') {
        mergedPopulate = { '*': true, ...ensure };
      } else if (typeof existing === 'object') {
        mergedPopulate = { ...existing, ...ensure };
      }
    }
    ctx.query = { ...ctx.query, populate: mergedPopulate };
    return await super.findOne(ctx);
  },
  async claim(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    // Optional: Only allow claim if unclaimed, unless admin
    const existing = await strapi.entityService.findOne('api::lead.lead', id, {
      populate: { claimedBy: true },
    });
    if (!existing) return ctx.notFound('Lead not found');
    const currentClaimantId = existing.claimedBy && existing.claimedBy.id;
    if (currentClaimantId && currentClaimantId !== user.id) {
      return ctx.forbidden('Lead already claimed');
    }

    const updated = await strapi.entityService.update('api::lead.lead', id, {
      data: { claimedBy: user.id },
      populate: {
        addedBy: { fields: ['username', 'email'] },
        claimedBy: { fields: ['username', 'email'] },
      },
    });

    ctx.body = { data: updated };
  },
}));
