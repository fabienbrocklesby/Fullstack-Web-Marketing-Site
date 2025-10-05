"use strict";

module.exports = {
  async active(ctx) {
    try {
      const now = new Date().toISOString();
      const banners = await strapi.entityService.findMany(
        "api::banner.banner",
        {
          filters: {
            enabled: true,
            $and: [
              {
                $or: [{ startAt: null }, { startAt: { $lte: now } }],
              },
              { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
            ],
          },
          sort: { updatedAt: "desc" },
          publicationState: "live",
          fields: [
            "id",
            "message",
            "severity",
            "linkUrl",
            "dismissible",
            "startAt",
            "endAt",
            "updatedAt",
          ],
        },
      );

      const banner =
        Array.isArray(banners) && banners.length ? banners[0] : null;
      ctx.body = { banner };
    } catch (err) {
      ctx.status = 500;
      ctx.body = {
        error: "Failed to fetch active banner",
        message: err.message,
      };
    }
  },
};
