import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import JSZip from "jszip";

/**
 * Clean source-package builder.
 *
 * Produces a zip of the deployable project — application code, configs, docs
 * and lockfile — with a single top-level `ai-tools-central/` folder so it
 * extracts tidily. Deliberately EXCLUDED (see SECURITY.md):
 *
 *   - `node_modules/`, `.next/`           → rebuilt from the lockfile
 *   - `db/`, `*.db`, `.env`               → secrets & PII never leave the machine
 *   - `dev.log`, `public/downloads/`      → runtime artifacts
 *   - sandbox folders (`examples/`, `tests/`, `mini-services/`, `skills/`,
 *     `agent-ctx/`, `download/`, `upload/`, `.zscripts/`, `Caddyfile`)
 *   - `bun.lock`                          → the package ships pnpm-first
 *
 * The same manifest backs both consumers:
 *   - `GET /api/download`  (browser download, auth-gated per policy below)
 *   - `pnpm package`       (CLI, writes the zip into `download/`)
 */

const PACKAGE_NAME = "ai-tools-central";

/** Files copied verbatim into the zip root (missing optional ones are skipped). */
const TOP_LEVEL_FILES = [
  "README.md",
  "DEPLOYMENT.md",
  "DEPLOY-MACOS.md",
  "SECURITY.md",
  ".env.example",
  ".gitignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "netlify.toml",
  "tsconfig.json",
  "next.config.ts",
  "next-env.d.ts",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "components.json",
  "prisma.config.ts",
];

/** Directories walked recursively. */
const INCLUDED_DIRS = ["src", "prisma", "scripts", "public"];

/** Never ship these, even if they appear inside an included directory. */
const EXCLUDED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db"]);
const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "downloads",
  "generated", // Prisma 7 client output (src/generated) — rebuilt by `prisma generate`
]);
const EXCLUDED_SUFFIXES = [".log", ".tsbuildinfo", ".db", ".db-journal"];

export interface SourcePackageResult {
  buffer: Buffer;
  filename: string;
  fileCount: number;
}

/** Thrown when the working directory doesn't look like the project root
 *  (e.g. a standalone production build) — callers map this to a 501. */
export class SourcePackageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcePackageUnavailableError";
  }
}

interface FileEntry {
  zipPath: string;
  absPath: string;
}

async function walkDir(dir: string, relDir: string, out: FileEntry[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (EXCLUDED_FILE_NAMES.has(entry.name)) continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      await walkDir(path.join(dir, entry.name), `${relDir}/${entry.name}`, out);
    } else if (entry.isFile()) {
      if (EXCLUDED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
      out.push({ zipPath: `${PACKAGE_NAME}/${relDir}/${entry.name}`, absPath: path.join(dir, entry.name) });
    }
  }
}

async function collectFiles(root: string): Promise<FileEntry[]> {
  const files: FileEntry[] = [];

  for (const name of TOP_LEVEL_FILES) {
    const absPath = path.join(root, name);
    try {
      const s = await stat(absPath);
      if (s.isFile()) files.push({ zipPath: `${PACKAGE_NAME}/${name}`, absPath });
    } catch {
      // Optional file (e.g. .env.example may be absent in a fork) — skip.
    }
  }

  for (const dir of INCLUDED_DIRS) {
    const absDir = path.join(root, dir);
    try {
      const s = await stat(absDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    await walkDir(absDir, dir, files);
  }

  return files;
}

async function doBuild(): Promise<SourcePackageResult> {
  const root = process.cwd();

  // Serverless hosts (Vercel, Netlify, …) ship only the traced runtime
  // files — there is no source tree in the function bundle, and a partially
  // traced one must never be presented as "the source". Fail closed with a
  // pointer to where the real source lives instead.
  if (process.env.VERCEL || process.env.NETLIFY) {
    throw new SourcePackageUnavailableError(
      "Source downloads aren't available on this host (Vercel/Netlify) — the serverless bundle contains no source tree. " +
        "Grab the code from the project's git repository (or run `pnpm package` from a checkout).",
    );
  }

  // Sanity check: refuse to build from a directory that isn't the project
  // root (e.g. a standalone `next start` server that only ships compiled
  // output — there is no source tree to package there).
  try {
    await stat(path.join(root, "src", "app", "page.tsx"));
  } catch {
    throw new SourcePackageUnavailableError(
      "The source tree is not available in this deployment — build the package from a checkout with `pnpm package` instead."
    );
  }

  const files = await collectFiles(root);
  if (files.length < 20) {
    // A truncated manifest (wrong cwd, half-deleted checkout) should never
    // silently ship. 20 is far below the real count, far above zero.
    throw new SourcePackageUnavailableError(
      `Source manifest looks incomplete (${files.length} files) — refusing to build a broken package.`
    );
  }

  let version = "1.0.0";
  try {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { version?: string };
    if (typeof pkg.version === "string" && pkg.version.trim()) version = pkg.version.trim();
  } catch {
    // Fall back to the default version — never fail a build over metadata.
  }

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.zipPath, await readFile(file.absPath));
  }
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return { buffer, filename: `${PACKAGE_NAME}-${version}.zip`, fileCount: files.length };
}

// Build at most once per server process (the zip is deterministic for a given
// checkout); a failed build clears the slot so the next request can retry.
let cached: Promise<SourcePackageResult> | null = null;

export function buildSourcePackage(): Promise<SourcePackageResult> {
  if (!cached) {
    cached = doBuild().catch((err: unknown) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

/**
 * Who may call GET /api/download.
 *
 * Mirrors the admin demo-password philosophy: open in development (so the
 * sandbox preview offers a one-click download) and **fail closed in
 * production**, where only an authenticated admin may fetch the source.
 * `SOURCE_DOWNLOAD_PUBLIC` overrides both directions explicitly.
 */
export function sourceDownloadPolicy(): "public" | "admin" {
  const flag = process.env.SOURCE_DOWNLOAD_PUBLIC?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return "public";
  if (flag === "false" || flag === "0") return "admin";
  return process.env.NODE_ENV === "production" ? "admin" : "public";
}
