/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "profiles/index.json"],
      manifest: {
        name: "Hex World",
        short_name: "Hex World",
        description:
          "Offline-first hex strategy survival — claim territory, manage noise, and find the hidden lab.",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "screenshots/wide-onboarding.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Field Notes cover — begin a new run",
          },
          {
            src: "screenshots/wide-setup.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Choose your leader name and colour",
          },
          {
            src: "screenshots/wide-gameplay.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Build and defend your hex base",
          },
          {
            src: "screenshots/narrow-onboarding.png",
            sizes: "720x1280",
            type: "image/png",
            form_factor: "narrow",
            label: "Field Notes cover — begin a new run",
          },
          {
            src: "screenshots/narrow-setup.png",
            sizes: "720x1280",
            type: "image/png",
            form_factor: "narrow",
            label: "Choose your leader name and colour",
          },
          {
            src: "screenshots/narrow-gameplay.png",
            sizes: "720x1280",
            type: "image/png",
            form_factor: "narrow",
            label: "Build and defend your hex base",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,jsonc,ico,png}"],
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
