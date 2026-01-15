import path from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      root: __dirname,
    }),
  ],
  resolve: {
    alias: [
      // Self-referential imports within the shared package
      // Order matters: more specific paths first
      {
        find: /^@evevault\/shared\/(.+)$/,
        replacement: path.resolve(__dirname, "./src/$1"),
      },
      {
        find: "@evevault/shared",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    mainFields: ["module", "main"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    // Only run tests from src/, not from compiled dist/
    exclude: ["**/node_modules/**", "**/dist/**"],
    server: {
      deps: {
        // Force vitest to inline and transform workspace packages
        inline: [/@evevault\/shared/],
      },
    },
  },
});
