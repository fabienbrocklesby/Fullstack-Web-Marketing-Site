module.exports = {
  async create(ctx) {
    const body = ctx.request.body || {};
    const payload = body.data || body;

    const fullName = (payload.fullName || payload.name || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    if (!fullName || !email) {
      return ctx.badRequest("fullName and email are required");
    }

    const source = (payload.source || ctx.request.header["referer"] || "").trim();
    const campaign = (payload.campaign || "").trim();
    const metadata = payload.metadata || {
      ip: ctx.request.ip,
      userAgent: ctx.request.header["user-agent"],
    };

    try {
      const existing = await strapi.db
        .query("api::mailing-list-signup.mailing-list-signup")
        .findOne({ where: { email, campaign } });

      if (existing) {
        ctx.body = { id: existing.id, duplicate: true };
        return;
      }

      const record = await strapi.entityService.create(
        "api::mailing-list-signup.mailing-list-signup",
        {
          data: {
            fullName,
            email,
            source,
            campaign,
            notes: payload.notes || "",
            metadata,
          },
        },
      );

      ctx.body = { id: record.id };
    } catch (error) {
      strapi.log.error("[mailing-list-signup] create failed", error);
      ctx.throw(500, "Unable to record signup");
    }
  },
};
