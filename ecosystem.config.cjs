module.exports = {
  apps: [
  {
      name: "strapi-backend",
      cwd: "./backend",
  // Run build then start via pnpm scripts (user-requested flow)
  script: "bash",
  args: ["-c", "pnpm build && pnpm start"],
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
      // Build then run the SSR server entry directly (preferred for production)
      // NOTE: For faster restarts you can remove the build step once stable and deploy with a manual build.
      script: "bash",
      args: ["-c", "pnpm build && node ./dist/server/entry.mjs"],
      env: {
        NODE_ENV: "production",
        PORT: 4321
      },
      watch: false
    }
  ],
  deploy: {}
}