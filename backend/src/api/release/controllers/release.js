"use strict";

module.exports = {
  async latest(ctx) {
    try {
      let release = null;
      // Prefer explicitly marked current release
      const current = await strapi.entityService.findMany(
        "api::release.release",
        {
          filters: { isCurrent: true },
          sort: { updatedAt: "desc" },
          limit: 1,
        },
      );
      if (Array.isArray(current) && current.length) {
        release = current[0];
      }

      // Fallback to the most recently created release
      if (!release) {
        const latestList = await strapi.entityService.findMany(
          "api::release.release",
          {
            sort: { createdAt: "desc" },
            limit: 1,
          },
        );
        release =
          Array.isArray(latestList) && latestList.length ? latestList[0] : null;
      }

      ctx.body = { release };
    } catch (err) {
      ctx.status = 500;
      ctx.body = { error: "Failed to fetch latest release" };
    }
  },
};
