import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Shared Vitest configuration for the monorepo.
 * Individual workspaces can extend this config if they need overrides.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "build/",
        ".wxt/",
        ".output/",
        "**/*.config.{ts,js,mjs,cjs}",
        "**/routeTree.gen.ts",
      ],
    },
  },
});
