#!/usr/bin/env node

/**
 * Clean all caches and build artifacts (but NOT node_modules)
 * Works cross-platform on Windows, macOS, and Linux
 * Usage: bun run clean:cache
 */

import { existsSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");

console.log("🧹 Cleaning caches and build artifacts...");
console.log(`📁 Working in: ${ROOT_DIR}`);

function removePath(path) {
  const fullPath = join(ROOT_DIR, path);
  if (existsSync(fullPath)) {
    try {
      rmSync(fullPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.warn(`⚠️  Could not remove ${path}: ${error.message}`);
      return false;
    }
  }
  return false;
}

// Remove Vite cache
console.log("🗑️  Removing Vite cache...");
removePath(".vite");
removePath("apps/extension/.vite");
removePath("apps/web/.vite");
removePath("apps/extension/node_modules/.vite");
removePath("apps/web/node_modules/.vite");
removePath("packages/shared/.vite");
removePath("node_modules/.vite");

// Remove Turbo cache
console.log("🗑️  Removing Turbo cache...");
removePath(".turbo");
removePath("apps/extension/.turbo");
removePath("apps/web/.turbo");
removePath("packages/shared/.turbo");

// Remove WXT output (extension specific)
console.log("🗑️  Removing WXT output...");
removePath("apps/extension/.output");
removePath("apps/extension/.wxt");

// Remove TypeScript build output (dist folders)
console.log("🗑️  Removing TypeScript build output (dist folders)...");
removePath("packages/shared/dist");
removePath("apps/extension/dist");
removePath("apps/web/dist");

// Remove TypeScript build info
console.log("🗑️  Removing TypeScript build info...");

import { readdirSync, rmdirSync, statSync, unlinkSync } from "fs";

function removeTsBuildInfo(dir) {
  const fullDir = join(ROOT_DIR, dir);
  if (!existsSync(fullDir)) return;

  try {
    const entries = readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(fullDir, entry.name);
      if (entry.isDirectory()) {
        removeTsBuildInfo(join(dir, entry.name));
        try {
          rmdirSync(fullPath);
        } catch {
          // Ignore errors when removing directories
        }
      } else if (entry.name.endsWith(".tsbuildinfo")) {
        try {
          unlinkSync(fullPath);
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

removeTsBuildInfo(".");
removeTsBuildInfo("apps");
removeTsBuildInfo("packages");

// Remove other common caches
console.log("🗑️  Removing other caches...");
removePath(".cache");
removePath("apps/extension/.cache");
removePath("apps/web/.cache");
removePath("packages/shared/.cache");

console.log("");
console.log("✅ All caches and build artifacts cleared!");
console.log("");
console.log("You can now restart your dev server with: bun run dev");
console.log("Note: If you need to rebuild, run: bun run build");
