import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const host = "127.0.0.1";
const port = Number(process.env.LABDITS_LOCAL_DEPLOYMENT_PORT || 8787);
const root = path.join(process.env.LOCALAPPDATA || homedir(), "LABDITS", "previews");
const projects = new Map();
const previewServers = new Map();

await mkdir(root, { recursive: true });

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
}

function json(response, status = 200) {
  return new Response(JSON.stringify(response), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

function now() {
  return new Date().toISOString();
}

function deployment(project, patch = {}) {
  const createdAt = project.createdAt || now();
  project.createdAt = createdAt;
  project.deployment = {
    projectId: project.id,
    deploymentId: project.deployment?.deploymentId || `dep_${randomUUID()}`,
    status: "pending",
    stage: 4,
    detectedFramework: project.analysis?.framework || null,
    detectedLanguage: project.analysis?.language || null,
    buildCommand: project.config?.buildCommand || project.analysis?.buildCommand || null,
    outputDirectory: project.config?.outputDirectory || project.analysis?.outputDirectory || null,
    previewUrl: null,
    verified: false,
    embeddable: true,
    errorMessage: null,
    createdAt,
    updatedAt: now(),
    ...project.deployment,
    ...patch,
  };
  return project.deployment;
}

function log(project, level, message) {
  project.logs.push({ timestamp: now(), level, message });
  process.stdout.write(`[${project.id}] ${message}\n`);
}

function safeRelativePath(name) {
  const normalized = String(name).replaceAll("\\", "/").replace(/^[A-Za-z]:/, "");
  const parts = normalized.split("/").filter((part) => part && part !== ".");
  if (!parts.length || parts.includes("..")) throw new Error(`Unsafe file path: ${name}`);
  return parts.join("/");
}

function stripCommonRoot(files) {
  if (files.some((file) => file.relativePath === "package.json")) return files;
  const roots = new Set(files.map((file) => file.relativePath.split("/")[0]));
  if (roots.size !== 1) return files;
  const rootName = [...roots][0];
  if (!files.some((file) => file.relativePath === `${rootName}/package.json`)) return files;
  return files.map((file) => ({ ...file, relativePath: file.relativePath.slice(rootName.length + 1) }));
}

async function parseMultipart(request) {
  const form = await request.formData();
  const received = [];
  for (const [key, value] of form.entries()) {
    if (key !== "files" || typeof value === "string") continue;
    received.push({
      relativePath: safeRelativePath(value.name),
      bytes: Buffer.from(await value.arrayBuffer()),
    });
  }
  return {
    files: stripCommonRoot(received),
    productId: String(form.get("productId") || "product"),
    sourceType: String(form.get("sourceType") || "files"),
  };
}

async function writeProjectFiles(projectDir, files) {
  for (const file of files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error("File escaped project root");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
}

async function findLocalSource(rootName) {
  if (!rootName || path.basename(rootName) !== rootName) return null;
  const candidates = [
    path.join("C:\\xampp\\htdocs", rootName),
    path.join(homedir(), "Desktop", rootName),
    path.join(homedir(), "Documents", rootName),
    path.join(homedir(), "Downloads", rootName),
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(path.join(candidate, "package.json"))).isFile()) return candidate;
    } catch {
      // Try the next approved local project root.
    }
  }
  return null;
}

async function importLocalFiles(sourceDir, projectDir, files) {
  for (const entry of files) {
    const relativePath = safeRelativePath(entry.path);
    const source = path.resolve(sourceDir, relativePath);
    const target = path.resolve(projectDir, relativePath);
    if (!source.startsWith(`${sourceDir}${path.sep}`) || !target.startsWith(`${projectDir}${path.sep}`)) {
      throw new Error("File escaped the approved project root");
    }
    const info = await stat(source);
    if (!info.isFile() || info.size !== entry.size) {
      throw new Error(`Local source changed: ${relativePath}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(project, command, args) {
  return new Promise((resolve, reject) => {
    log(project, "info", `$ ${command} ${args.join(" ")}`);
    const isWindowsNpm =
      process.platform === "win32" && path.basename(command).toLowerCase() === "npm.cmd";
    const actualCommand = isWindowsNpm ? process.execPath : command;
    const actualArgs = isWindowsNpm
      ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), ...args]
      : args;
    const child = spawn(actualCommand, actualArgs, {
      cwd: project.sourceDir,
      env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
      windowsHide: true,
      shell: false,
    });
    const collect = (level) => (chunk) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) log(project, level, line);
    };
    child.stdout.on("data", collect("info"));
    child.stderr.on("data", collect("warn"));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)),
    );
  });
}

async function getProject(id) {
  const active = projects.get(id);
  if (active) return active;
  const sourceDir = path.join(root, id, "source");
  try {
    const pkg = JSON.parse(await readFile(path.join(sourceDir, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const info = await stat(sourceDir);
    const restored = {
      id,
      uploadId: `upload_restored_${id}`,
      sourceType: "zip",
      sourceDir,
      logs: [],
      createdAt: info.birthtime.toISOString(),
      analysis: {
        framework: deps.next ? "Next.js" : "Unknown",
        language: deps.typescript ? "TypeScript" : "JavaScript",
      },
    };
    projects.set(id, restored);
    log(restored, "info", "Restored local deployment state");
    return restored;
  } catch {
    return null;
  }
}

function capture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `${command} exited with code ${code}`)),
    );
  });
}

async function extractZip(project, archivePath) {
  const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
  const listing = await capture(tar, ["-tf", archivePath], project.sourceDir);
  for (const entry of listing.split(/\r?\n/).filter(Boolean)) {
    if (entry.endsWith("/")) continue;
    safeRelativePath(entry);
  }
  await run(project, tar, ["-xf", archivePath, "-C", project.sourceDir]);
  try {
    if ((await stat(path.join(project.sourceDir, "package.json"))).isFile()) return;
  } catch {
    // Look for a single top-level project directory.
  }
  const children = await readdir(project.sourceDir, { withFileTypes: true });
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const candidate = path.join(project.sourceDir, child.name);
    try {
      if ((await stat(path.join(candidate, "package.json"))).isFile()) {
        project.sourceDir = candidate;
        return;
      }
    } catch {
      // Keep looking for the project root.
    }
  }
  throw new Error("The ZIP does not contain a package.json at its project root.");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const selected = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(selected));
    });
  });
}

async function waitForHealthy(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Preview did not respond";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
      lastError = `Preview returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(lastError);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[ext] || "application/octet-stream"
  );
}

async function startStaticPreview(project, directory, selectedPort) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", `http://${host}`).pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
      let target = path.resolve(directory, relative);
      if (!target.startsWith(`${directory}${path.sep}`) && target !== directory) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      try {
        if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      } catch {
        target = path.join(directory, "index.html");
      }
      response.writeHead(200, { "content-type": contentType(target) });
      createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(404).end(error instanceof Error ? error.message : "Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(selectedPort, host, resolve);
  });
  previewServers.set(project.id, { close: () => server.close() });
}

async function startNextPreview(project, selectedPort) {
  const nextBin = path.join(project.sourceDir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-H", host, "-p", String(selectedPort)], {
    cwd: project.sourceDir,
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
    windowsHide: true,
    shell: false,
  });
  child.stdout.on("data", (chunk) => log(project, "info", String(chunk).trim()));
  child.stderr.on("data", (chunk) => log(project, "warn", String(chunk).trim()));
  child.on("exit", (code) => log(project, code === 0 ? "info" : "error", `Preview exited (${code})`));
  previewServers.set(project.id, { close: () => child.kill() });
}

async function buildAndServe(project) {
  try {
    deployment(project, { status: "building", stage: 5, errorMessage: null });
    log(project, "info", "Installing dependencies");
    const install = project.config.installCommand.trim();
    if (!/^npm (ci|install)$/.test(install)) {
      throw new Error("Local deployment currently accepts only npm ci or npm install.");
    }
    await run(project, executable("npm"), install.split(" ").slice(1));

    deployment(project, { status: "building", stage: 6 });
    log(project, "info", "Building application");
    if (project.config.buildCommand.trim() !== "npm run build") {
      throw new Error("Local deployment currently accepts only npm run build.");
    }
    await run(project, executable("npm"), ["run", "build"]);

    deployment(project, { status: "deploying", stage: 7 });
    const selectedPort = await freePort();
    const framework = project.analysis?.framework || "";
    if (framework === "Next.js") {
      await startNextPreview(project, selectedPort);
    } else {
      const outputDir = path.resolve(project.sourceDir, project.config.outputDirectory);
      if (!outputDir.startsWith(`${project.sourceDir}${path.sep}`)) {
        throw new Error("Output directory must stay inside the project.");
      }
      await startStaticPreview(project, outputDir, selectedPort);
    }

    const previewUrl = `http://${host}:${selectedPort}/`;
    deployment(project, { status: "deploying", stage: 8, previewUrl });
    log(project, "info", `Checking ${previewUrl}`);
    await waitForHealthy(previewUrl);
    deployment(project, { status: "ready", stage: 9, previewUrl, verified: true });
    log(project, "info", "Live demo ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deployment(project, { status: "failed", errorMessage: message, verified: false });
    log(project, "error", message);
  }
}

async function handle(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method === "GET" && pathname === "/health") return json({ ok: true });

  if (request.method === "POST" && pathname === "/api/projects/upload") {
    const input = await parseMultipart(request);
    if (!input.files.length) return json({ message: "No files received" }, 400);
    const fingerprint = createHash("sha1")
      .update(input.files.map((file) => `${file.relativePath}:${file.bytes.length}`).join("|"))
      .digest("hex")
      .slice(0, 10);
    const id = `${input.productId}-${fingerprint}-${Date.now().toString(36)}`;
    const sourceDir = path.join(root, id, "source");
    await mkdir(sourceDir, { recursive: true });
    const totalSize = input.files.reduce((sum, file) => sum + file.bytes.length, 0);
    const project = {
      id,
      uploadId: `upload_${randomUUID()}`,
      sourceType: input.sourceType,
      sourceDir,
      logs: [],
      createdAt: now(),
    };
    projects.set(id, project);
    if (input.files.length === 1 && input.files[0].relativePath.toLowerCase().endsWith(".zip")) {
      const archivePath = path.join(root, id, "upload.zip");
      await writeFile(archivePath, input.files[0].bytes);
      log(project, "info", `Received project ZIP (${totalSize} bytes)`);
      await extractZip(project, archivePath);
      log(project, "info", "Project ZIP extracted");
    } else {
      await writeProjectFiles(sourceDir, input.files);
      log(project, "info", `Received ${input.files.length} files (${totalSize} bytes)`);
    }
    return json({ projectId: id, uploadId: project.uploadId, fileCount: input.files.length, totalSize });
  }

  if (request.method === "POST" && pathname === "/api/projects/import-local") {
    const input = await request.json();
    const sourceDir = await findLocalSource(String(input.rootName || ""));
    if (!sourceDir) return json({ message: "Selected local project folder could not be found." }, 404);
    const files = Array.isArray(input.files) ? input.files : [];
    if (!files.length) return json({ message: "No file manifest received" }, 400);
    const fingerprint = createHash("sha1")
      .update(files.map((file) => `${file.path}:${file.size}`).join("|"))
      .digest("hex")
      .slice(0, 10);
    const id = `${String(input.productId || "product")}-${fingerprint}-${Date.now().toString(36)}`;
    const importedDir = path.join(root, id, "source");
    await mkdir(importedDir, { recursive: true });
    await importLocalFiles(sourceDir, importedDir, files);
    const totalSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const project = {
      id,
      uploadId: `upload_${randomUUID()}`,
      sourceType: String(input.sourceType || "folder"),
      sourceDir: importedDir,
      logs: [],
      createdAt: now(),
    };
    projects.set(id, project);
    log(project, "info", `Imported ${files.length} files from ${sourceDir}`);
    return json({ projectId: id, uploadId: project.uploadId, fileCount: files.length, totalSize });
  }

  if (request.method === "POST" && pathname === "/api/projects/analyze") {
    const body = await request.json();
    const project = await getProject(body.projectId);
    if (!project) return json({ message: "Project not found" }, 404);
    project.analysis = body.clientAnalysis;
    log(project, "info", `Detected ${project.analysis.framework} / ${project.analysis.language}`);
    return json({ projectId: project.id, analysis: project.analysis });
  }

  const match = pathname.match(/^\/api\/projects\/([^/]+)\/(deploy|deployment|logs|preview|publish)$/);
  if (!match) return json({ message: "Not found" }, 404);
  const project = await getProject(decodeURIComponent(match[1]));
  if (!project) return json({ message: "Project not found" }, 404);
  const action = match[2];

  if (request.method === "POST" && action === "deploy") {
    project.config = await request.json();
    deployment(project, { status: "pending", stage: 4, errorMessage: null });
    void buildAndServe(project);
    return json(project.deployment);
  }
  if (request.method === "GET" && action === "deployment") {
    return json(deployment(project));
  }
  if (request.method === "GET" && action === "logs") {
    return json({ projectId: project.id, deploymentId: project.deployment?.deploymentId || null, lines: project.logs });
  }
  if (request.method === "GET" && action === "preview") {
    const current = deployment(project);
    return json({ projectId: project.id, previewUrl: current.previewUrl, verified: current.verified, embeddable: true });
  }
  if (request.method === "POST" && action === "publish") {
    const body = await request.json();
    const current = deployment(project);
    const published = Boolean(body.published) && current.status === "ready" && current.verified;
    return json({ projectId: project.id, published, errorMessage: published ? null : "A verified preview is required." });
  }
  return json({ message: "Method not allowed" }, 405);
}

const server = createServer(async (request, response) => {
  try {
    const origin = request.headers.origin;
    if (origin && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "Local deployment API only accepts localhost origins." }));
      return;
    }
    const webRequest = new Request(`http://${request.headers.host}${request.url}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : Readable.toWeb(request),
      duplex: "half",
    });
    const result = await handle(webRequest);
    response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.writeHead(500, { "content-type": "application/json", ...corsHeaders() });
    response.end(JSON.stringify({ message }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`LABDITS local deployment API listening on http://${host}:${port}\n`);
});

function shutdown() {
  for (const preview of previewServers.values()) preview.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
