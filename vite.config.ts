import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "QuoteLite",
        short_name: "QuoteLite",
        description: "Quotes and invoices for a small trade crew.",
        theme_color: "#8C2F0E",
        background_color: "#EEF0F3",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,ico,webmanifest,woff2}"],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
