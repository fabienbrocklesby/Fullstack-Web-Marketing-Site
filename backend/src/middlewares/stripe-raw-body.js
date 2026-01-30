"use strict";

const { Readable } = require("stream");

/**
 * Stripe Webhook Raw Body Middleware
 *
 * Stripe webhook signature verification requires the raw request body.
 * Strapi's body parser converts it to JSON before we can access it.
 *
 * This middleware captures the raw body for /api/stripe/webhook route only.
 * It stores the raw buffer in ctx.request.rawBody for later use.
 * 
 * After capturing the raw body, it replaces ctx.req with a new readable stream
 * containing the same data so that strapi::body can still read it without errors.
 * 
 * IMPORTANT: This middleware MUST run before strapi::body in config/middlewares.js
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Only apply to stripe webhook route (match with and without trailing slash)
    const isWebhookRoute = 
      (ctx.request.path === "/api/stripe/webhook" || ctx.request.path === "/api/stripe/webhook/") &&
      ctx.request.method === "POST";

    if (!isWebhookRoute) {
      return next();
    }

    // Prevent double-reading if rawBody already captured
    if (ctx.request.rawBody) {
      return next();
    }

    try {
      // Capture raw body from the underlying Node.js request stream
      // This must happen BEFORE any body parser consumes the stream
      const chunks = [];
      
      await new Promise((resolve, reject) => {
        ctx.req.on("data", (chunk) => chunks.push(chunk));
        ctx.req.on("end", () => resolve());
        ctx.req.on("error", (err) => reject(err));
      });
      
      const rawBody = Buffer.concat(chunks);
      
      // Store raw body for signature verification in the webhook controller
      ctx.request.rawBody = rawBody;
      
      strapi.log.debug(`[stripe-raw-body] Captured ${rawBody.length} bytes for webhook`);
      
      // Create a new readable stream with the captured data
      // This allows strapi::body to read the stream without errors
      const newStream = new Readable({
        read() {
          this.push(rawBody);
          this.push(null); // Signal end of stream
        }
      });
      
      // Copy all headers and properties from the original request
      newStream.headers = ctx.req.headers;
      newStream.method = ctx.req.method;
      newStream.url = ctx.req.url;
      newStream.httpVersion = ctx.req.httpVersion;
      newStream.httpVersionMajor = ctx.req.httpVersionMajor;
      newStream.httpVersionMinor = ctx.req.httpVersionMinor;
      newStream.connection = ctx.req.connection;
      newStream.socket = ctx.req.socket;
      
      // Replace the consumed request with our new stream
      ctx.req = newStream;
      
    } catch (err) {
      strapi.log.error(`[stripe-raw-body] Failed to capture raw body: ${err.message}`);
      ctx.status = 400;
      ctx.body = { error: "Failed to read request body" };
      return;
    }
    
    await next();
  };
};
