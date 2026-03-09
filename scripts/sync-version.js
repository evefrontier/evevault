#!/usr/bin/env node

/**
 * Sync root package.json version from apps/extension (after changeset version).
 * Extension, web, and shared are versioned by Changesets (fixed group).
 * Root is not in the fixed group, so we copy the version from extension.
 * Run after: bun run version (which runs changeset version && this script).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const EXTENSION_PKG = join(ROOT_DIR, "apps/extension/package.json");
const ROOT_PKG = join(ROOT_DIR, "package.json");

const extPkg = JSON.parse(readFileSync(EXTENSION_PKG, "utf-8"));
const version = extPkg.version;
if (!version || typeof version !== "string") {
  console.error("apps/extension/package.json must have a string 'version'.");
  process.exit(1);
}

const rootPkg = JSON.parse(readFileSync(ROOT_PKG, "utf-8"));
rootPkg.version = version;
writeFileSync(ROOT_PKG, `${JSON.stringify(rootPkg, null, 2)}\n`, "utf-8");
console.log(`Synced root version -> ${version}`);
