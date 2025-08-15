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
      // Run build then preview (static/SSR preview as requested)
      script: "bash",
      args: ["-c", "pnpm build && pnpm preview"],
      env: {
        NODE_ENV: "production",
        PORT: 4321
      },
      watch: false
    }
  ],
  deploy: {}
}