#!/usr/bin/env node

/**
 * Sync root package.json version to apps and shared package.
 * Single source of truth: root package.json "version".
 * Run after bumping version: bun run version:sync
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const rootPkg = JSON.parse(
  readFileSync(join(ROOT_DIR, "package.json"), "utf-8"),
);
const version = rootPkg.version;
if (!version || typeof version !== "string") {
  console.error("Root package.json must have a string 'version' field.");
  process.exit(1);
}

const targets = [
  "apps/extension/package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
];

for (const relPath of targets) {
  const fullPath = join(ROOT_DIR, relPath);
  const pkg = JSON.parse(readFileSync(fullPath, "utf-8"));
  pkg.version = version;
  writeFileSync(fullPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  console.log(`Updated ${relPath} -> ${version}`);
}

console.log(`Version ${version} synced to ${targets.length} package(s).`);
