import { defineConfig } from "astro/config";
// Add the Node adapter so Astro can produce a runnable server build under PM2
// If you only need a fully static site behind Nginx, you can instead set: output: 'static' and remove the adapter.
import node from "@astrojs/node";

export default defineConfig({
  site: "https://lightlane.app",
  output: "server", // switch to 'static' if you prefer a pure static export
  server: { host: true }, // allow remote access in dev (binds 0.0.0.0)
  adapter: node({ mode: "standalone" }), // standalone bundles deps for simpler deployment
});
