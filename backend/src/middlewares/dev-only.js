/**
 * Production blocker middleware
 * Blocks access to development-only endpoints in production environment
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    if (process.env.NODE_ENV === 'production') {
      strapi.log.warn(`Blocked production access to dev-only endpoint: ${ctx.request.path}`);
      ctx.status = 404;
      ctx.body = {
        error: 'Not Found',
        message: 'This endpoint does not exist',
      };
      return;
    }
    
    // In development, allow but log
    strapi.log.info(`Dev-only endpoint accessed: ${ctx.request.path}`);
    await next();
  };
};
