"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/banner/active",
      handler: "banner.active",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
