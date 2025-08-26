const jwt = require("jsonwebtoken");

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const token = ctx.request.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return ctx.unauthorized("No token provided");
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret",
      );

      // Check if this is a customer token
      if (decoded.type !== "customer") {
        return ctx.unauthorized("Invalid token type");
      }

      // Get customer from database
      const customer = await strapi.entityService.findOne(
        "api::customer.customer",
        decoded.id,
      );

      if (!customer) {
        return ctx.unauthorized("Customer not found");
      }

      if (!customer.isActive) {
        return ctx.unauthorized("Customer account is deactivated");
      }

      // Add customer to context
      ctx.state.customer = customer;

      await next();
    } catch (error) {
      console.error("Customer auth error:", error);
      return ctx.unauthorized("Invalid token");
    }
  };
};
