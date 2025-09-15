"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/release/latest",
      handler: "release.latest",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
