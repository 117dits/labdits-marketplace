// Client-side, read-only project inspection. Never executes uploaded code:
// it only lists file names and parses small JSON/text metadata files.
import type {
  PackageManager,
  ProjectAnalysis,
  ProjectFileEntry,
  Compatibility,
} from "@/types/deployment";

export interface InspectableEntry extends ProjectFileEntry {
  read?: (() => Promise<string>) | undefined;
}

export const KEY_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "index.html",
  "angular.json",
  "astro.config.mjs",
  "astro.config.ts",
  "nuxt.config.ts",
  "nuxt.config.js",
  "svelte.config.js",
  "tsconfig.json",
  "tailwind.config.js",
  "tailwind.config.ts",
  "composer.json",
  "artisan",
  "manage.py",
  "requirements.txt",
  ".env",
  ".env.example",
  ".env.sample",
];
const READABLE = new Set([
  "package.json",
  "index.html",
  "index_raw.html",
  "angular.json",
  ".env.example",
  ".env.sample",
  "composer.json",
]);
const IGNORED = /(^|\/)(node_modules|\.git|\.next|dist|build|\.output|\.svelte-kit)\//;

export function isUnsafePath(path: string) {
  return path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split(/[\\/]/).includes("..");
}

/** Remove the shared top folder ("my-app/src/x" -> "src/x"). */
function stripRoot(entries: InspectableEntry[]) {
  const first = entries[0]?.path.split("/")[0];
  if (
    first &&
    entries.length > 0 &&
    entries.every((e) => e.path.includes("/") && e.path.split("/")[0] === first)
  )
    return {
      root: first,
      entries: entries.map((e) => ({ ...e, path: e.path.slice(first.length + 1) })),
    };
  return { root: undefined, entries };
}

// ---------- ZIP central-directory reader (no extraction to disk, no execution) ----------
async function inflateRaw(data: Uint8Array) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Response(stream).text();
}
export async function readZipEntries(file: File): Promise<InspectableEntry[]> {
  const tailSize = Math.min(file.size, 65557);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("This file is not a valid ZIP archive.");
  const count = tail.getUint16(eocd + 10, true),
    cdSize = tail.getUint32(eocd + 12, true),
    cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff)
    throw new Error("ZIP64 archives are not supported for browser inspection.");
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const decoder = new TextDecoder();
  const out: InspectableEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const method = cd.getUint16(p + 10, true),
      compSize = cd.getUint32(p + 20, true),
      size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true),
      extraLen = cd.getUint16(p + 30, true),
      commentLen = cd.getUint16(p + 32, true),
      local = cd.getUint32(p + 42, true);
    const path = decoder
      .decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen))
      .replace(/\\/g, "/");
    p += 46 + nameLen + extraLen + commentLen;
    if (path.endsWith("/")) continue;
    const base = path.split("/").pop() || "";
    const read =
      READABLE.has(base) && size < 512 * 1024 && (method === 0 || method === 8)
        ? async () => {
            const lh = new DataView(await file.slice(local, local + 30).arrayBuffer());
            const start = local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
            const bytes = new Uint8Array(await file.slice(start, start + compSize).arrayBuffer());
            return method === 0 ? decoder.decode(bytes) : inflateRaw(bytes);
          }
        : undefined;
    out.push({ path, size, read });
  }
  return out;
}

export function entriesFromFiles(files: File[]): InspectableEntry[] {
  return files.map((f) => {
    const path = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    const base = path.split("/").pop() || "";
    return {
      path,
      size: f.size,
      read: READABLE.has(base) && f.size < 512 * 1024 ? () => f.text() : undefined,
    };
  });
}

export interface InspectionResult {
  root?: string | undefined;
  entries: InspectableEntry[];
  problems: string[];
  totalSize: number;
}
export function inspectEntries(raw: InspectableEntry[]): InspectionResult {
  const problems: string[] = [];
  const unsafe = raw.filter((e) => isUnsafePath(e.path));
  if (unsafe.length)
    problems.push(
      `${unsafe.length} file path(s) try to escape the project folder (for example "${unsafe[0]?.path}").`,
    );
  const filtered = raw.filter((e) => !isUnsafePath(e.path));
  const { root, entries } = stripRoot(filtered);
  const kept = entries.filter((e) => !IGNORED.test(`/${e.path}`));
  const totalSize = kept.reduce((s, e) => s + e.size, 0);
  if (!kept.length) problems.push("No project files were found.");
  return { root, entries: kept, problems, totalSize };
}

const has = (deps: Record<string, string>, name: string) =>
  Object.prototype.hasOwnProperty.call(deps, name);

export async function analyzeProject(
  entries: InspectableEntry[],
  fallbackName: string,
): Promise<ProjectAnalysis> {
  const paths = entries.map((e) => e.path);
  const atRoot = (name: string) => paths.includes(name);
  const find = (name: string) => entries.find((e) => e.path === name);
  const keyFiles = KEY_FILES.filter(atRoot);
  const notes: string[] = [];
  let pkg: {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    packageManager?: string;
  } | null = null;
  const pkgEntry = find("package.json");
  if (pkgEntry?.read) {
    try {
      pkg = JSON.parse(await pkgEntry.read());
    } catch {
      notes.push("package.json could not be parsed. Check that it is valid JSON.");
    }
  } else if (pkgEntry) notes.push("package.json was found but could not be read in the browser.");
  const deps: Record<string, string> = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  const scripts = pkg?.scripts || {};

  // Package manager
  let packageManager: PackageManager = pkg ? "unknown" : "none";
  const pmField = pkg?.packageManager?.split("@")[0];
  if (pmField === "pnpm" || pmField === "yarn" || pmField === "npm" || pmField === "bun")
    packageManager = pmField;
  else if (atRoot("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (atRoot("yarn.lock")) packageManager = "yarn";
  else if (atRoot("bun.lockb") || atRoot("bun.lock")) packageManager = "bun";
  else if (atRoot("package-lock.json")) packageManager = "npm";
  if (pkg && packageManager === "unknown")
    notes.push("No lockfile found. Package manager could not be confirmed.");

  // Language & styling
  const tsFiles = paths.some((p) => /\.(ts|tsx|mts|cts)$/.test(p) && !p.endsWith(".d.ts"));
  const language =
    tsFiles || atRoot("tsconfig.json") || has(deps, "typescript")
      ? "TypeScript"
      : pkg
        ? "JavaScript"
        : paths.some((p) => p.endsWith(".html"))
          ? "HTML / CSS / JavaScript"
          : paths.some((p) => p.endsWith(".php"))
            ? "PHP"
            : paths.some((p) => p.endsWith(".py"))
              ? "Python"
              : "Unknown";
  const styling: string[] = [];
  if (has(deps, "tailwindcss") || paths.some((p) => /^tailwind\.config\./.test(p)))
    styling.push("Tailwind CSS");
  if (has(deps, "sass")) styling.push("Sass");

  // Framework
  let framework = "Unknown",
    outputDirectory: string | null = null,
    needsServerRuntime = false,
    compatibility: Compatibility = "configuration_required",
    confidence: ProjectAnalysis["confidence"] = "low";
  const vite = has(deps, "vite");
  if (has(deps, "@tanstack/react-start") || has(deps, "@tanstack/start")) {
    framework = "TanStack Start";
    outputDirectory = ".output";
    needsServerRuntime = true;
    compatibility = "supported";
    confidence = "high";
    notes.push("TanStack Start needs a compatible server or edge runtime for SSR routes.");
  } else if (has(deps, "next")) {
    framework = "Next.js";
    outputDirectory = ".next";
    needsServerRuntime = true;
    compatibility = "supported";
    confidence = "high";
    notes.push('Next.js requires a Node.js runtime unless configured with output: "export".');
  } else if (has(deps, "nuxt")) {
    framework = "Nuxt";
    outputDirectory = ".output";
    needsServerRuntime = true;
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "@sveltejs/kit")) {
    framework = "SvelteKit";
    compatibility = "configuration_required";
    confidence = "medium";
    notes.push(
      "SvelteKit output depends on the configured adapter. Set the output directory manually.",
    );
  } else if (has(deps, "astro")) {
    framework = "Astro";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "@angular/core")) {
    framework = "Angular";
    compatibility = "supported";
    confidence = "medium";
    const ang = find("angular.json");
    if (ang?.read) {
      try {
        const cfg = JSON.parse(await ang.read());
        const proj = Object.values(cfg.projects || {})[0] as
          | { architect?: { build?: { options?: { outputPath?: string | { base?: string } } } } }
          | undefined;
        const op = proj?.architect?.build?.options?.outputPath;
        outputDirectory = typeof op === "string" ? op : op?.base || null;
      } catch {
        /* manual config */
      }
    }
    if (!outputDirectory)
      notes.push("Angular output path was not found in angular.json. Set it manually.");
  } else if (has(deps, "@solidjs/start")) {
    framework = "SolidStart";
    outputDirectory = ".output";
    needsServerRuntime = true;
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "@builder.io/qwik")) {
    framework = "Qwik";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "gatsby")) {
    framework = "Gatsby";
    outputDirectory = "public";
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "@remix-run/react") || has(deps, "@remix-run/dev")) {
    framework = "Remix";
    outputDirectory = "build";
    needsServerRuntime = true;
    compatibility = "supported";
    confidence = "high";
    notes.push(
      "Remix needs a compatible server runtime unless the project is configured as SPA mode.",
    );
  } else if (vite && has(deps, "react")) {
    framework = "React + Vite";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (vite && has(deps, "vue")) {
    framework = "Vue.js + Vite";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (vite && has(deps, "svelte")) {
    framework = "Svelte + Vite";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (vite && has(deps, "preact")) {
    framework = "Preact + Vite";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "react-scripts")) {
    framework = "React (Create React App)";
    outputDirectory = "build";
    compatibility = "supported";
    confidence = "high";
  } else if (has(deps, "@vue/cli-service")) {
    framework = "Vue.js (Vue CLI)";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "high";
  } else if (vite) {
    framework = "Vite";
    outputDirectory = "dist";
    compatibility = "supported";
    confidence = "medium";
  } else if (has(deps, "@nestjs/core")) {
    framework = "NestJS (backend)";
    needsServerRuntime = true;
    confidence = "high";
    notes.push("Backend applications need a dedicated server runtime and usually a database.");
  } else if (has(deps, "express") || has(deps, "fastify") || has(deps, "koa")) {
    framework = has(deps, "express")
      ? "Express (backend)"
      : has(deps, "fastify")
        ? "Fastify (backend)"
        : "Koa (backend)";
    needsServerRuntime = true;
    confidence = "high";
    notes.push("Backend applications need a dedicated server runtime.");
  } else if (atRoot("artisan") || atRoot("composer.json")) {
    framework = atRoot("artisan") ? "Laravel" : "PHP (Composer)";
    needsServerRuntime = true;
    compatibility = "unsupported";
    confidence = "high";
    notes.push(
      "PHP projects require a specialized runtime that is not part of the standard pipeline.",
    );
  } else if (atRoot("manage.py")) {
    framework = "Django";
    needsServerRuntime = true;
    compatibility = "unsupported";
    confidence = "high";
    notes.push("Python projects require a specialized runtime.");
  } else if (!pkg && atRoot("index.html")) {
    framework = "Static HTML";
    outputDirectory = ".";
    compatibility = "supported";
    confidence = "high";
  } else if (pkg && atRoot("index.html") && !scripts["build"]) {
    // A project with index.html at root and no build script is a Static site
    // (e.g. static landing pages, HTML/JS/CSS prototypes, or repos with dev scripts only).
    framework = "Static HTML";
    outputDirectory = ".";
    compatibility = "supported";
    confidence = "high";
    notes.push("Detected root index.html with no build step; deploying as static site.");
  } else if (pkg) {
    framework = "Node.js project (unrecognized)";
    notes.push("Framework not recognized. Configure the build manually.");
  }

  // Build command: only from an actual script, never invented.
  const run =
    packageManager === "yarn"
      ? "yarn"
      : packageManager === "pnpm"
        ? "pnpm run"
        : packageManager === "bun"
          ? "bun run"
          : "npm run";
  const buildCommand = framework === "Static HTML" ? "" : scripts["build"] ? `${run} build` : null;
  if (pkg && !scripts["build"]) notes.push('No "build" script found in package.json.');
  const installCommand = !pkg
    ? ""
    : packageManager === "pnpm"
      ? "pnpm install --frozen-lockfile"
      : packageManager === "yarn"
        ? "yarn install --frozen-lockfile"
        : packageManager === "bun"
          ? "bun install"
          : packageManager === "npm"
            ? "npm ci"
            : null;

  // Environment variables
  const envKeys: string[] = [];
  for (const name of [".env.example", ".env.sample"]) {
    const e = find(name);
    if (e?.read) {
      try {
        (await e.read()).split("\n").forEach((l) => {
          const m = l.match(/^\s*([A-Z0-9_]+)\s*=/);
          if (m?.[1]) envKeys.push(m[1]);
        });
      } catch {
        /* ignore */
      }
    }
  }
  if (atRoot(".env"))
    notes.push(
      "A .env file is included. Remove secrets from uploads; configure them securely on the deployment backend.",
    );
  const serviceDeps = [
    "@supabase/supabase-js",
    "firebase",
    "prisma",
    "@prisma/client",
    "mongoose",
    "pg",
    "mysql2",
    "stripe",
    "drizzle-orm",
  ].filter((d) => has(deps, d));
  if (serviceDeps.length)
    notes.push(
      `Uses external services (${serviceDeps.join(", ")}). Environment variables are likely required.`,
    );
  const envRequired = envKeys.length > 0 || serviceDeps.length > 0;

  if (
    compatibility === "supported" &&
    (buildCommand === null || (outputDirectory === null && framework !== "Next.js") || envRequired)
  )
    compatibility = "configuration_required";
  if (needsServerRuntime && /backend/.test(framework)) compatibility = "configuration_required";
  if (compatibility === "configuration_required" && framework === "Unknown") confidence = "low";

  return {
    projectName: pkg?.name || fallbackName,
    framework,
    language,
    styling,
    packageManager,
    buildCommand,
    installCommand,
    outputDirectory,
    needsServerRuntime,
    envRequired,
    envKeys,
    compatibility,
    keyFiles,
    notes,
    confidence,
  };
}
