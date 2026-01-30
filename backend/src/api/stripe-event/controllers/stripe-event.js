"use strict";

/**
 * stripe-event controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::stripe-event.stripe-event");
