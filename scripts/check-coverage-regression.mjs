import fs from "node:fs";
import path from "node:path";

const [baseRoot, currentRoot] = process.argv.slice(2);

if (!baseRoot || !currentRoot) {
  console.error("Usage: check-coverage-regression.mjs <baseRoot> <currentRoot>");
  process.exit(1);
}

const reports = [
  ["@evevault/shared", "packages/shared/coverage/coverage-summary.json"],
  ["@evevault/extension", "apps/extension/coverage/coverage-summary.json"],
  ["@evevault/web", "apps/web/coverage/coverage-summary.json"],
];

const metrics = ["lines", "statements", "functions", "branches"];
const tolerance = Number(process.env.UNCOVERED_TOLERANCE ?? 3);

/**
 * Strip the machine-specific absolute prefix from a coverage path, leaving a
 * repo-relative key like "apps/extension/src/lib/foo.ts". Istanbul embeds the
 * full checkout path in every key, which differs across runs/machines.
 */
function repoRelative(absPath) {
  for (const marker of ["/apps/", "/packages/"]) {
    const idx = absPath.indexOf(marker);
    if (idx !== -1) return absPath.slice(idx + 1);
  }
  return absPath;
}

function fmtPct(pct) {
  return `${pct.toFixed(1)}%`;
}

function fmtDelta(delta) {
  if (Math.abs(delta) < 0.05) return "±0%";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

let overallFailed = false;
const summaryRows = [];

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

  const baseData = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const currentData = JSON.parse(fs.readFileSync(currentPath, "utf8"));

  // Index current report by repo-relative path so absolute-path differences
  // between the baseline run and this run don't cause false misses.
  const currentByRel = {};
  for (const [p, v] of Object.entries(currentData)) {
    if (p !== "total") currentByRel[repoRelative(p)] = v;
  }

  const regressions = [];

  for (const [filePath, baseMetrics] of Object.entries(baseData)) {
    if (filePath === "total") continue;

    const rel = repoRelative(filePath);
    const currentMetrics = currentByRel[rel];
    if (!currentMetrics) continue; // file deleted or renamed — not a regression

    for (const metric of metrics) {
      const baseUncovered =
        baseMetrics[metric].total - baseMetrics[metric].covered;
      const currentUncovered =
        currentMetrics[metric].total - currentMetrics[metric].covered;

      if (currentUncovered > baseUncovered + tolerance) {
        regressions.push({ rel, metric, baseUncovered, currentUncovered });
      }
    }
  }

  if (regressions.length > 0) {
    console.error(`\n❌ ${name}: coverage regression detected`);
    for (const { rel, metric, baseUncovered, currentUncovered } of regressions) {
      console.error(
        `   ${rel}\n     ${metric}: ${baseUncovered} uncovered → ${currentUncovered} uncovered (+${currentUncovered - baseUncovered})`,
      );
    }
    overallFailed = true;
  } else {
    console.log(`✓ ${name}`);
  }

  // Collect totals for the Markdown summary table.
  const baseTotal = baseData.total ?? {};
  const currentTotal = currentData.total ?? {};
  const row = { name, failed: regressions.length > 0 };
  for (const metric of metrics) {
    row[metric] = {
      current: currentTotal[metric]?.pct ?? 0,
      delta: (currentTotal[metric]?.pct ?? 0) - (baseTotal[metric]?.pct ?? 0),
    };
  }
  summaryRows.push(row);
}

// Build a Markdown table of per-package totals with base→current deltas.
// Written to GITHUB_STEP_SUMMARY when running in CI; printed to stdout locally.
const mdLines = [
  "## Coverage",
  "",
  "| Package | Status | Lines | Statements | Functions | Branches |",
  "| ------- | :----: | ----- | ---------- | --------- | -------- |",
];
for (const row of summaryRows) {
  const status = row.failed ? "❌" : "✅";
  const cols = metrics.map((m) => {
    const { current, delta } = row[m];
    return `${fmtPct(current)} *(${fmtDelta(delta)})*`;
  });
  mdLines.push(`| ${row.name} | ${status} | ${cols.join(" | ")} |`);
}
mdLines.push("");

const mdOutput = mdLines.join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, mdOutput);
} else {
  console.log("\n" + mdOutput);
}

if (overallFailed) {
  console.error(
    "\nOne or more files have more uncovered lines/branches than the baseline.",
  );
  process.exit(1);
}
console.log("\nCoverage maintained.");
