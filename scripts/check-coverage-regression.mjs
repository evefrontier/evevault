import fs from "node:fs";
import path from "node:path";

const [baseRoot, currentRoot] = process.argv.slice(2);
const tolerance = Number(process.env.COVERAGE_TOLERANCE ?? 0);

const reports = [
  ["@evevault/shared", "packages/shared/coverage/coverage-summary.json"],
  ["@evevault/extension", "apps/extension/coverage/coverage-summary.json"],
  ["@evevault/web", "apps/web/coverage/coverage-summary.json"],
];

const metrics = ["lines", "statements", "functions", "branches"];
let failed = false;

for (const [name, reportPath] of reports) {
  const base = JSON.parse(fs.readFileSync(path.join(baseRoot, reportPath), "utf8")).total;
  const current = JSON.parse(fs.readFileSync(path.join(currentRoot, reportPath), "utf8")).total;

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
