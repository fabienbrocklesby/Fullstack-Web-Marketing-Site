const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::purchase.purchase",
  ({ strapi }) => ({
    async find(ctx) {
      // Get the user from the request
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized(
          "You must be logged in to access purchase data",
        );
      }

      // Find user's affiliate record first
      const affiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      if (affiliates.length === 0) {
        ctx.body = {
          data: [],
          meta: {
            pagination: {
              page: 1,
              pageSize: 0,
              pageCount: 1,
              total: 0,
            },
          },
        };
        return;
      }

      const affiliate = affiliates[0];

      // Find purchases for this affiliate
      const purchases = await strapi.entityService.findMany(
        "api::purchase.purchase",
        {
          filters: {
            affiliate: affiliate.id,
            ...ctx.query.filters,
          },
          populate: ["affiliate"],
          sort: ctx.query.sort || { createdAt: "desc" },
          pagination: ctx.query.pagination || { page: 1, pageSize: 100 },
        },
      );

      ctx.body = {
        data: purchases,
        meta: {
          pagination: {
            page: 1,
            pageSize: purchases.length,
            pageCount: 1,
            total: purchases.length,
          },
        },
      };
    },

    async findOne(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("You must be logged in");
      }

      const purchase = await strapi.entityService.findOne(
        "api::purchase.purchase",
        id,
        {
          populate: ["affiliate"],
        },
      );

      if (!purchase) {
        return ctx.notFound("Purchase not found");
      }

      // Check if user owns this purchase (through affiliate)
      const userAffiliates = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: {
            $or: [{ user: user.id }, { email: user.email }],
          },
        },
      );

      const userOwnsthisPurchase = userAffiliates.some(
        (affiliate) => affiliate.id === purchase.affiliate?.id,
      );

      if (!userOwnsthisPurchase) {
        return ctx.forbidden("You can only access your own purchase data");
      }

      return purchase;
    },
  }),
);
