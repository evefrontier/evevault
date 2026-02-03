import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    react(),
    tanstackRouter({ quoteStyle: "double" }),
    tailwindcss(),
    // Automatically resolve path aliases from tsconfig.json
    tsconfigPaths({
      root: __dirname,
    }),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "icon/favicon-16.png",
        "icon/favicon-32.png",
        "icon/favicon-192.png",
        "icon/favicon-512.png",
      ],
      manifest: {
        name: "EVE Vault",
        short_name: "EVE Vault",
        description: "EVE Vault Wallet for Sui Blockchain",
        theme_color: "#FF4700",
        background_color: "#1C1D1F",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon/favicon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon/favicon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        maximumFileSizeToCacheInBytes: 2.5 * 1024 * 1024, // 2.5 MB to accommodate large background image assets (~2.1 MB)
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/graphql\.(mainnet|testnet|devnet)\.sui\.io\/graphql/,
            handler: "NetworkFirst",
            options: {
              cacheName: "sui-graphql-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 3001, // Web app port (extension uses 3000)
    strictPort: true, // Don't auto-switch ports
  },
  // Configure Vite to load env vars from monorepo root
  envDir: path.resolve(__dirname, "../.."),
  optimizeDeps: {
    include: ["@evevault/shared", "@evevault/shared/adapters"],
  },
});
