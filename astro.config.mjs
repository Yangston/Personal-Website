import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const productionBuild = process.argv.includes("build");
const vercel = productionBuild
  ? (await import("@astrojs/vercel")).default
  : undefined;

export default defineConfig({
  site: "https://stoneyang.ca",
  output: "static",
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  devToolbar: { enabled: false },
  ...(productionBuild
    ? {
        adapter: vercel({
          imageService: true,
          webAnalytics: { enabled: process.env.VERCEL === "1" },
        }),
      }
    : {}),
  integrations: [mdx(), react(), sitemap()],
  vite: {
    server: {
      watch: {
        ignored: [
          "**/.private/**",
          "**/.vercel/**",
          "**/.venv-photo-calibration/**",
          "**/public/media/photography/**",
          "**/src/content/photography/iCloud Photos/**",
        ],
      },
    },
    plugins: [tailwindcss()],
  },
});
