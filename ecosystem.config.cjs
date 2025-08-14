module.exports = {
  apps: [
    {
      name: "strapi-backend",
      cwd: "./backend",
      script: "node",
      args: "./node_modules/.bin/strapi start",
      env: {
        NODE_ENV: "production"
      },
      watch: false,
      max_memory_restart: "750M"
    },
    {
      name: "astro-frontend",
      cwd: "./frontend",
      script: "node",
      args: "./node_modules/.bin/astro preview",
      env: {
        NODE_ENV: "production",
        PORT: 4321
      },
      watch: false
    }
  ],
  deploy: {}
}