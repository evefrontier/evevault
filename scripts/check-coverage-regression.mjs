import fs from "node:fs";
import path from "node:path";

const [baseRoot, currentRoot] = process.argv.slice(2);

if (!baseRoot || !currentRoot) {
  console.error("Usage: check-coverage-regression.mjs <baseRoot> <currentRoot>");
  process.exit(1);
}

const tolerance = Number(process.env.COVERAGE_TOLERANCE ?? 0);

const reports = [
  ["@evevault/shared", "packages/shared/coverage/coverage-summary.json"],
  ["@evevault/extension", "apps/extension/coverage/coverage-summary.json"],
  ["@evevault/web", "apps/web/coverage/coverage-summary.json"],
];

const metrics = ["lines", "statements", "functions", "branches"];
let failed = false;

for (const [name, reportPath] of reports) {
  const basePath = path.join(baseRoot, reportPath);
  const currentPath = path.join(currentRoot, reportPath);

  if (!fs.existsSync(basePath)) {
    console.error(`Missing baseline report for ${name}: ${basePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(currentPath)) {
    console.error(`Missing current report for ${name}: ${currentPath}`);
    process.exit(1);
  }

  const base = JSON.parse(fs.readFileSync(basePath, "utf8")).total;
  const current = JSON.parse(fs.readFileSync(currentPath, "utf8")).total;

  for (const metric of metrics) {
    const before = base[metric].pct;
    const after = current[metric].pct;

    if (after + tolerance < before) {
      console.error(
        `${name} ${metric} coverage dropped: ${before}% -> ${after}%`,
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("Coverage is maintained.");
