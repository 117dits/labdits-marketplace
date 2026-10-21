import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileArchive,
  FolderOpen,
  X,
  RotateCw,
  Info,
  AlertTriangle,
  CheckCircle2,
  Folder,
  FileText,
  Rocket,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  analyzeProject,
  entriesFromFiles,
  inspectEntries,
  readZipEntries,
  type InspectableEntry,
} from "@/lib/project-analyzer";
import { prepareDeploymentConfig } from "@/lib/deployment-config";
import {
  BackendNotConnectedError,
  deploymentService,
  isDeploymentBackendConnected,
  pollDeployment,
} from "@/services/deployment-service";
import {
  DEPLOYMENT_STAGES,
  SPECIAL_RUNTIME_FRAMEWORKS,
  SUPPORTED_PROJECT_FRAMEWORKS,
  SUPPORTED_PROJECT_LANGUAGES,
  type BuildConfig,
  type DeploymentStatus,
  type ProjectRecord,
} from "@/types/deployment";

export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
export const statusLabel: Record<DeploymentStatus, string> = {
  pending: "Pending",
  uploading: "Uploading",
  analyzing: "Analyzing",
  building: "Building",
  deploying: "Deploying",
  ready: "Ready",
  failed: "Failed",
  configuration_required: "Configuration Required",
  backend_required: "Backend Integration Required",
};
export const statusClass = (s: DeploymentStatus) =>
  s === "ready"
    ? "status-positive"
    : s === "failed"
      ? "text-destructive"
      : s === "configuration_required" || s === "backend_required"
        ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
        : "status-pending";

export function SupportedProjectStacks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-md border border-border bg-secondary/30 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <strong>Supported languages:</strong>
        {SUPPORTED_PROJECT_LANGUAGES.map((language) => (
          <span className="status status-positive" key={language}>
            {language}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Frameworks: {SUPPORTED_PROJECT_FRAMEWORKS.join(" · ")}
      </p>
      {!compact && (
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {SPECIAL_RUNTIME_FRAMEWORKS.join(" · ")} are detected too, but require a dedicated server
          runtime and environment configuration.
        </p>
      )}
    </div>
  );
}

/** Which pipeline stage index has been reached (exclusive) */
export function reachedStage(p?: ProjectRecord) {
  if (!p) return 0;
  if (p.deployment)
    return p.deployment.status === "ready" && p.deployment.verified
      ? 10
      : Math.max(4, p.deployment.stage);
  let n = p.files.length ? 1 : 0;
  if (n && p.localStatus !== "failed") n = 2;
  if (p.uploadId) n = 3;
  if (p.analysis && p.uploadId) n = 4;
  return n;
}
export function currentStatus(p?: ProjectRecord): DeploymentStatus {
  return p?.deployment?.status ?? p?.localStatus ?? "pending";
}

export function DeploymentPipeline({ project }: { project?: ProjectRecord | undefined }) {
  const reached = reachedStage(project),
    status = currentStatus(project);
  return (
    <ol className="grid gap-2 sm:grid-cols-2" aria-label="Deployment stages">
      {DEPLOYMENT_STAGES.map((s, i) => {
        const done = i < reached,
          active = i === reached && status !== "ready";
        const failed = active && status === "failed";
        const warning =
          active &&
          (status === "configuration_required" || status === "backend_required");
        return (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : failed ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : warning ? (
              <Info className="h-4 w-4 text-amber-500" />
            ) : (
              <span className="grid h-4 w-4 place-items-center font-mono text-[9px]">{i + 1}</span>
            )}
            <span className="flex-1">{s}</span>
            {active && (
              <span className={`status ${statusClass(status)}`}>{statusLabel[status]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FileTree({ files }: { files: { path: string; size: number }[] }) {
  const rows = useMemo(() => {
    const dirs = new Map<string, { count: number; size: number }>();
    const top: { path: string; size: number }[] = [];
    files.forEach((f) => {
      const [first, ...rest] = f.path.split("/");
      if (rest.length && first) {
        const d = dirs.get(first) || { count: 0, size: 0 };
        d.count++;
        d.size += f.size;
        dirs.set(first, d);
      } else top.push(f);
    });
    return {
      dirs: [...dirs.entries()].sort(),
      top: top.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }, [files]);
  return (
    <div
      className="max-h-64 overflow-auto rounded-md border border-border p-3 font-mono text-[11px]"
      aria-label="Project file tree"
    >
      {rows.dirs.map(([d, v]) => (
        <div key={d} className="flex justify-between gap-3 py-0.5">
          <span className="flex items-center gap-2">
            <Folder className="h-3 w-3 text-primary" />
            {d}/ <span className="text-muted-foreground">{v.count} files</span>
          </span>
          <span className="text-muted-foreground">{formatBytes(v.size)}</span>
        </div>
      ))}
      {rows.top.slice(0, 200).map((f) => (
        <div key={f.path} className="flex justify-between gap-3 py-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{f.path}</span>
          </span>
          <span className="text-muted-foreground">{formatBytes(f.size)}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectUploader({
  productId,
  value,
  onChange,
}: {
  productId: string;
  value?: ProjectRecord | undefined;
  onChange: (p: ProjectRecord | undefined) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null),
    folderRef = useRef<HTMLInputElement>(null);
  const raw = useRef<File[]>([]);
  const abort = useRef<AbortController | null>(null);
  const [problems, setProblems] = useState<string[]>([]),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [logs, setLogs] = useState<{ timestamp: string; level: string; message: string }[] | null>(null),
    [loadingLogs, setLoadingLogs] = useState(false);
  const connected = isDeploymentBackendConnected();
  const latest = useRef(value);
  latest.current = value;
  const set = (patch: Partial<ProjectRecord>) => {
    const base = latest.current;
    if (!base) return;
    const next = { ...base, ...patch };
    latest.current = next;
    onChange(next);
  };

  // Resume polling for in-progress deployments; cleaned up on unmount.
  const pollingId =
    value?.projectId &&
    value.deployment &&
    !["ready", "failed", "configuration_required"].includes(value.deployment.status)
      ? value.projectId
      : undefined;
  useEffect(() => {
    if (!pollingId) return;
    return pollDeployment(pollingId, {
      onUpdate: (d) => set({ deployment: d }),
      onError: (e) => toast.error(e.message),
    });
  }, [pollingId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function select(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    setProgress(0);
    const zip = files.length === 1 && files[0]!.name.toLowerCase().endsWith(".zip");
    let entries: InspectableEntry[];
    try {
      entries = zip ? await readZipEntries(files[0]!) : entriesFromFiles(files);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read archive");
      return;
    }
    const res = inspectEntries(entries);
    setProblems(res.problems);
    raw.current = files;
    const base: ProjectRecord = {
      sourceType: zip ? "zip" : files.some((f) => f.webkitRelativePath) ? "folder" : "files",
      files: res.entries.map(({ path, size }) => ({ path, size })),
      totalSize: zip ? files[0]!.size : res.totalSize,
      localStatus: res.problems.length ? "failed" : "analyzing",
    };
    latest.current = base;
    onChange(base);
    if (res.problems.length) return;
    const analysis = await analyzeProject(
      res.entries,
      res.root || files[0]!.name.replace(/\.zip$/i, ""),
    );
    set({
      analysis,
      buildConfig: {
        installCommand: analysis.installCommand ?? "",
        buildCommand: analysis.buildCommand ?? "",
        outputDirectory: analysis.outputDirectory ?? "",
        nodeVersion: "20",
        envNotes: analysis.envKeys.join(", "),
      },
      localStatus: analysis.compatibility === "supported" ? "pending" : "configuration_required",
    });
  }

  async function upload() {
    if (!value) return;
    if (!raw.current.length) {
      toast.error("Select the project files again to upload them.");
      return;
    }
    abort.current = new AbortController();
    setBusy(true);
    setProgress(0);
    set({ localStatus: "uploading", localMessage: undefined });
    try {
      const r = await deploymentService.upload(
        raw.current,
        { productId, sourceType: value.sourceType, files: value.files },
        setProgress,
        abort.current.signal,
      );
      set({ projectId: r.projectId, uploadId: r.uploadId, localStatus: "analyzing" });
      if (value.analysis) {
        const a = await deploymentService.analyze(r.projectId, value.analysis);
        set({
          analysis: a.analysis,
          localStatus:
            a.analysis.compatibility === "supported" ? "pending" : "configuration_required",
        });
      }
      toast.success("Project uploaded to storage");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        set({ localStatus: "pending", localMessage: "Upload cancelled." });
        toast.info("Upload cancelled");
      } else if (e instanceof BackendNotConnectedError)
        set({ localStatus: "backend_required", localMessage: e.message });
      else
        set({
          localStatus: "failed",
          localMessage: e instanceof Error ? e.message : "Upload failed",
        });
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  async function deploy() {
    if (!value?.projectId) {
      toast.error("Project ID not found. Upload files first.");
      return;
    }
    const currentConfig: BuildConfig = value.buildConfig || {
      installCommand: value.analysis?.installCommand || "npm install",
      buildCommand: value.analysis?.buildCommand || "npm run build",
      outputDirectory: value.analysis?.framework === "Next.js" ? "" : (value.analysis?.outputDirectory || ""),
      nodeVersion: "20",
      envNotes: "",
    };
    const { config, error } = prepareDeploymentConfig(value.analysis, currentConfig);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      set({ buildConfig: config, localMessage: undefined, localStatus: "building" });
      set({ deployment: await deploymentService.deploy(value.projectId, config) });
      set({ localStatus: "building", localMessage: undefined });
      toast.success("Deployment requested");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      toast.error(`Deploy error: ${msg}`);
      set({
        localStatus: e instanceof BackendNotConnectedError ? "backend_required" : "failed",
        localMessage: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  const a = value?.analysis,
    cfg = value?.buildConfig;
  const setCfg = (k: keyof BuildConfig, v: string) =>
    cfg && set({ buildConfig: { ...cfg, [k]: v } });
  return (
    <div className="form-stack">
      {!connected && (
        <>
          <div className="notice">
            <Info />
            <span>
              <strong>Backend Integration Required.</strong> TypeScript, JavaScript and supported
              frameworks can already be inspected and configured in your browser. Uploading,
              building and hosting still need the LABDITS deployment API (set{" "}
              <code>VITE_LABDITS_API_URL</code>). The product stays a draft until a verified demo
              exists.
            </span>
          </div>
          <SupportedProjectStacks />
        </>
      )}
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void select(e.dataTransfer.files);
        }}
      >
        <Upload />
        <h3>Drop a project ZIP or files here.</h3>
        <p>
          ZIP, project folder, or multiple files · No app-imposed size limit · Code is never
          executed here
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => fileRef.current?.click()}>
            <FileArchive />
            Choose ZIP or files
          </Button>
          <Button type="button" variant="outline" onClick={() => folderRef.current?.click()}>
            <FolderOpen />
            Choose folder
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void select(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          hidden
          multiple
          {...{ webkitdirectory: "", directory: "" }}
          onChange={(e) => {
            void select(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {problems.map((p) => (
        <div key={p} className="notice text-destructive">
          <AlertTriangle />
          {p}
        </div>
      ))}
      {value && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span>
              {value.files.length} files · {formatBytes(value.totalSize)} · {value.sourceType}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                raw.current = [];
                setProblems([]);
                onChange(undefined);
              }}
            >
              <X />
              Clear
            </Button>
          </div>
          <FileTree files={value.files} />
          {a && (
            <div className="panel">
              <h3 className="mb-3">Detection summary</h3>
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                {[
                  ["Project Name", a.projectName],
                  ["Framework", a.framework],
                  ["Language", a.language],
                  ["Styling", a.styling.join(", ") || "—"],
                  ["Package Manager", a.packageManager],
                  ["Build Command", a.buildCommand ?? "Not detected — configure manually"],
                  ["Output Directory", a.outputDirectory ?? "Not detected — configure manually"],
                  ["Server Runtime", a.needsServerRuntime ? "Required" : "Not required"],
                  [
                    "Environment Variables",
                    a.envRequired
                      ? `Required${a.envKeys.length ? ` (${a.envKeys.join(", ")})` : ""}`
                      : "None detected",
                  ],
                  [
                    "Deployment Compatibility",
                    a.compatibility === "supported"
                      ? "Supported"
                      : a.compatibility === "unsupported"
                        ? "Unsupported runtime"
                        : "Configuration Required",
                  ],
                  ["Confidence", a.confidence],
                  ["Key files", a.keyFiles.join(", ") || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              {a.notes.map((n) => (
                <p key={n} className="mt-2 flex gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  {n}
                </p>
              ))}
            </div>
          )}
          {cfg && (
            <div className="form-grid">
              {(
                [
                  ["installCommand", "Install command"],
                  ["buildCommand", "Build command"],
                  ["outputDirectory", "Output directory"],
                  ["nodeVersion", "Node version"],
                  ["envNotes", "Required env variable names (values set on backend)"],
                ] as const
              ).map(([k, l]) => (
                <div className="field" key={k}>
                  <label htmlFor={`cfg-${k}`}>{l}</label>
                  <input
                    id={`cfg-${k}`}
                    className="form-input font-mono"
                    value={cfg[k]}
                    onChange={(e) => setCfg(k, e.target.value)}
                    placeholder="Configure manually"
                  />
                </div>
              ))}
            </div>
          )}
          {busy && progress > 0 && (
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}
          {value.localMessage && (
            <div className={`notice ${value.localStatus === "failed" ? "border-destructive text-destructive" : ""}`}>
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1 text-xs">
                <strong>{value.localStatus === "failed" ? "Deployment Error:" : "Notice:"}</strong>{" "}
                {value.localMessage}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!value.uploadId && (
              <Button type="button" disabled={busy || !!problems.length} onClick={upload}>
                <Upload />
                {value.localStatus === "failed" || value.localStatus === "backend_required"
                  ? "Retry upload"
                  : "Upload project"}
              </Button>
            )}
            {busy && abort.current && (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                <X />
                Cancel upload
              </Button>
            )}
            {value.uploadId && (
              <Button type="button" disabled={busy} onClick={deploy}>
                <Rocket />
                {value.deployment?.status === "failed" ? "Retry deployment" : "Deploy demo"}
              </Button>
            )}
            {value.projectId && (
              <Button
                type="button"
                variant="outline"
                disabled={loadingLogs}
                onClick={async () => {
                  setLoadingLogs(true);
                  try {
                    const res = await deploymentService.getLogs(value.projectId!);
                    setLogs(res.lines);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed loading logs");
                  } finally {
                    setLoadingLogs(false);
                  }
                }}
              >
                <ScrollText />
                {loadingLogs ? "Loading logs..." : "View build logs"}
              </Button>
            )}
          </div>
          {logs && (
            <div className="panel mt-4 p-4 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between pb-2 mb-2 border-b">
                <span className="font-medium text-xs flex items-center gap-2">
                  <ScrollText className="h-4 w-4" /> Live Build Logs
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogs(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed select-text">
                {logs.length
                  ? logs.map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.message}`).join("\n")
                  : "No log lines available yet."}
              </pre>
            </div>
          )}
          <DeploymentPipeline project={value} />
          {value.deployment?.errorMessage && (
            <div className="notice text-destructive">
              <AlertTriangle />
              {value.deployment.errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
