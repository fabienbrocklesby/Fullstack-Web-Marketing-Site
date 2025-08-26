const buckets = new Map();
module.exports = (config, { strapi }) => {
  const windowMs = 60 * 1000;
  const max = 30;
  return async (ctx, next) => {
    const ip = ctx.request.ip || ctx.ip;
    const now = Date.now();
    const arr = buckets.get(ip) || [];
    const recent = arr.filter((ts) => now - ts < windowMs);
    recent.push(now);
    buckets.set(ip, recent);
    if (recent.length > max) {
      ctx.status = 429;
      ctx.body = { error: "Too many requests" };
      return;
    }
    await next();
  };
};
