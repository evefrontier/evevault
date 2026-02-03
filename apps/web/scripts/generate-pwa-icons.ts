/**
 * Generate favicon and PWA icons from public/icon/logo.svg (bracket logo on #0B0B0B).
 * Outputs to apps/web/public/icon (favicon-*.png) and apps/extension/public/icon (*.png).
 * Run from repo root: bun run apps/web/scripts/generate-pwa-icons.ts
 * Or from apps/web: bun run scripts/generate-pwa-icons.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appsWeb = join(__dirname, "..");
const repoRoot = join(appsWeb, "../..");
const webIconDir = join(appsWeb, "public", "icon");
const extIconDir = join(repoRoot, "apps", "extension", "public", "icon");
const sourceSvg = join(webIconDir, "logo.svg");

const WEB_SIZES = [16, 32, 192, 512] as const;
const EXT_SIZES = [16, 32, 48, 96, 128] as const;

async function main() {
  const svgBuffer = await readFile(sourceSvg);
  const pipeline = sharp(svgBuffer);

  await mkdir(webIconDir, { recursive: true });
  await mkdir(extIconDir, { recursive: true });

  for (const size of WEB_SIZES) {
    const buffer = await pipeline
      .clone()
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    const outPath = join(webIconDir, `favicon-${size}.png`);
    await writeFile(outPath, buffer);
    console.log(`Wrote ${outPath}`);
  }

  for (const size of EXT_SIZES) {
    const buffer = await pipeline
      .clone()
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    const outPath = join(extIconDir, `${size}.png`);
    await writeFile(outPath, buffer);
    console.log(`Wrote ${outPath}`);
  }

  console.log("Web and extension icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
