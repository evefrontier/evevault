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
      {
        find: /^#\/(.+)$/,
        replacement: path.resolve(__dirname, "./src/$1"),
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.{ts,js,mjs,cjs}",
      ],
    },
  },
});
