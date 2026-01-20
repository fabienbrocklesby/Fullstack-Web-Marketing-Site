"use strict";

/**
 * stripe-event router
 * No public routes - this collection is internal only for idempotency tracking
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::stripe-event.stripe-event");
