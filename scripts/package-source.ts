/**
 * CLI: build the clean source package.
 *
 *   pnpm package                 # writes download/ai-tools-central-<version>.zip
 *   pnpm package out/            # writes into a custom directory
 *
 * Shares the manifest with GET /api/download (src/lib/source-package.ts) so
 * the browser download and the CLI artifact are always identical.
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { buildSourcePackage } from "../src/lib/source-package";

async function main(): Promise<void> {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("download");

  try {
    const { buffer, filename, fileCount } = await buildSourcePackage();
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    await writeFile(outPath, buffer);
    const kb = (buffer.length / 1024).toFixed(0);
    console.log(`✔ ${filename} — ${fileCount} files, ${kb} KB → ${outPath}`);
  } catch (err) {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

void main();
