"use strict";

/**
 * stripe-event service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::stripe-event.stripe-event");
