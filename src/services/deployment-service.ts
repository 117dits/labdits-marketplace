// Replaceable deployment adapter. Talks to the LABDITS deployment backend when
// VITE_LABDITS_API_URL is configured; otherwise every call throws
// BackendNotConnectedError so the UI can show an honest "Backend Integration Required" state.
// It NEVER fabricates a successful build or preview URL.
import type { AnalyzeResponse, BuildConfig, DeploymentResponse, LogsResponse, PreviewResponse, ProjectAnalysis, PublishResponse, UploadResponse } from '@/types/deployment';
import { supabase } from '@/integrations/supabase/client';

type SessionClient = Pick<typeof supabase, 'auth'>;
export async function getDeploymentAuthHeaders(local: boolean, client: SessionClient = supabase, publishableKey = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined): Promise<Record<string, string>> {
  if (local) return {};
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to your admin account before deploying a project.');
  return {
    ...(publishableKey ? { apikey: publishableKey } : {}),
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

export class BackendNotConnectedError extends Error { constructor() { super('Backend Integration Required: no deployment API is configured.'); this.name = 'BackendNotConnectedError'; } }
export class DeploymentApiError extends Error { constructor(message: string, public status: number) { super(message); this.name = 'DeploymentApiError'; } }

function apiBase(): string | null {
  const configured = import.meta.env['VITE_LABDITS_API_URL'] as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/deploy-api`;
  return import.meta.env.DEV ? 'http://127.0.0.1:8787' : null;
}
export function isDeploymentBackendConnected() { return apiBase() !== null; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase(); if (!base) throw new BackendNotConnectedError();
  const local = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(base);
  const authHeaders = await getDeploymentAuthHeaders(local);
  const res = await fetch(`${base}${path}`, {
    credentials: 'omit',
    ...init,
    headers: {
      Accept: 'application/json',
      ...authHeaders,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (!res.ok) { let msg = `Request failed (${res.status})`; try { const j = await res.json(); if (j?.errorMessage || j?.message) msg = j.errorMessage || j.message; } catch { /* keep default */ } throw new DeploymentApiError(msg, res.status); }
  return res.json() as Promise<T>;
}

export const deploymentService = {
  /** POST /api/projects/upload — multipart; field "files" with relative paths as filenames. */
  async upload(files: File[], meta: { productId: string; sourceType: string; files?: { path: string; size: number }[] }, onProgress: (pct: number) => void, signal: AbortSignal): Promise<UploadResponse> {
    const base = apiBase(); if (!base) return Promise.reject(new BackendNotConnectedError());
    const local = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(base);
    if (local && files.some((file) => file.webkitRelativePath)) {
      const firstPath = files.find((file) => file.webkitRelativePath)?.webkitRelativePath ?? '';
      const rootName = firstPath.split('/')[0] ?? '';
      const manifest = meta.files ?? files.map((file) => ({
          path: (file.webkitRelativePath || file.name).replace(new RegExp(`^${rootName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), ''),
          size: file.size,
        }));
      onProgress(10);
      return request<UploadResponse>('/api/projects/import-local', {
        method: 'POST',
        signal,
        body: JSON.stringify({ productId: meta.productId, sourceType: meta.sourceType, rootName, files: manifest }),
      }).then((result) => {
        onProgress(100);
        return result;
      });
    }
    const authHeaders = await getDeploymentAuthHeaders(local);
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('productId', meta.productId); form.append('sourceType', meta.sourceType);
      const skipPrefixes = ['.git/', 'node_modules/', '.next/', 'dist/', 'build/', '.cache/', '.vercel/', 'test-results/', 'artifacts/'];
      files.forEach(f => {
        const path = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
        const shouldSkip = skipPrefixes.some(p => path.startsWith(p) || path.includes('/' + p));
        if (!shouldSkip) {
          form.append('files', f, f.webkitRelativePath || f.name);
        }
      });
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${base}/api/projects/upload`);
      xhr.withCredentials = false;
      for (const [name, value] of Object.entries(authHeaders)) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new DeploymentApiError('Invalid upload response', xhr.status)); } } else reject(new DeploymentApiError(`Upload failed (${xhr.status})`, xhr.status)); };
      xhr.onerror = () => reject(new DeploymentApiError('Network error during upload', 0));
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(form);
    });
  },
  /** POST /api/projects/analyze — server-side confirmation of the client analysis. */
  analyze(projectId: string, clientAnalysis: ProjectAnalysis) { return request<AnalyzeResponse>('/api/projects/analyze', { method: 'POST', body: JSON.stringify({ projectId, clientAnalysis }) }); },
  /** POST /api/projects/:id/deploy */
  deploy(projectId: string, config: BuildConfig) { return request<DeploymentResponse>(`/api/projects/${encodeURIComponent(projectId)}/deploy`, { method: 'POST', body: JSON.stringify(config) }); },
  /** GET /api/projects/:id/deployment */
  getDeployment(projectId: string, signal?: AbortSignal) { return request<DeploymentResponse>(`/api/projects/${encodeURIComponent(projectId)}/deployment`, { signal: signal ?? null }); },
  /** GET /api/projects/:id/logs */
  getLogs(projectId: string) { return request<LogsResponse>(`/api/projects/${encodeURIComponent(projectId)}/logs`); },
  /** GET /api/projects/:id/preview */
  getPreview(projectId: string) { return request<PreviewResponse>(`/api/projects/${encodeURIComponent(projectId)}/preview`); },
  /** POST /api/projects/:id/publish */
  publish(projectId: string, published: boolean) { return request<PublishResponse>(`/api/projects/${encodeURIComponent(projectId)}/publish`, { method: 'POST', body: JSON.stringify({ published }) }); },
};

const TERMINAL = new Set(['ready', 'failed', 'configuration_required']);
/** Polls deployment status until terminal, aborted, or limits reached. Returns a cleanup function. */
export function pollDeployment(projectId: string, opts: { onUpdate: (d: DeploymentResponse) => void; onError: (e: Error) => void; intervalMs?: number; maxAttempts?: number; maxConsecutiveErrors?: number }) {
  const controller = new AbortController();
  const interval = opts.intervalMs ?? 4000, maxAttempts = opts.maxAttempts ?? 225, maxErrors = opts.maxConsecutiveErrors ?? 3;
  let attempts = 0, errors = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (controller.signal.aborted) return;
    attempts++;
    try {
      const d = await deploymentService.getDeployment(projectId, controller.signal);
      errors = 0; opts.onUpdate(d);
      if (TERMINAL.has(d.status)) return;
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BackendNotConnectedError) { opts.onError(e); return; }
      if (++errors >= maxErrors) { opts.onError(e instanceof Error ? e : new Error('Polling failed')); return; }
    }
    if (attempts >= maxAttempts) { opts.onError(new Error('Deployment status polling timed out.')); return; }
    timer = setTimeout(tick, Math.min(interval * 2 ** errors, 30000));
  };
  void tick();
  return () => { controller.abort(); if (timer) clearTimeout(timer); };
}
