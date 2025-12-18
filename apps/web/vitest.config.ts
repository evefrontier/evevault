import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    envDir: path.resolve(__dirname, "."),
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["../../vitest.setup.ts"],
      passWithNoTests: true, // TODO(test): drop when web has dedicated suites
    },
  }),
);
