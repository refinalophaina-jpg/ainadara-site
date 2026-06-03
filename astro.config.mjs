import { defineConfig } from "astro/config";

// Static output, deployed to Cloudflare Pages.
export default defineConfig({
  site: "https://ainadara.com",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
});
