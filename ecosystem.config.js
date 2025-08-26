module.exports = {
  apps: [
    {
      name: "strapi-api",
      cwd: "apps/api",
      script: "pnpm",
      args: "start",
      env: { NODE_ENV: "production", PORT: "1337" }
    }
  ]
}
