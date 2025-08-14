module.exports = {
  apps: [
    {
      name: "strapi-backend",
      cwd: "./backend",
  // Explicit Node execution of Strapi JS entrypoint (avoid shell shim)
  script: "node",
  args: ["./node_modules/@strapi/strapi/bin/strapi.js", "start"],
      env: {
        NODE_ENV: "production"
      },
      watch: false,
      max_memory_restart: "750M",
      restart_delay: 4000,
      max_restarts: 5
    },
    {
      name: "astro-frontend",
      cwd: "./frontend",
      script: "node",
      // Use the Node adapter's server entry instead of preview (already built)
  args: ["./dist/server/entry.mjs"],
      env: {
        NODE_ENV: "production",
        PORT: 4000
      },
      watch: false
    }
  ],
  deploy: {}
}