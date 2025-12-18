import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
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
