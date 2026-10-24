#!/usr/bin/env node
/** Server-only polling worker. Never import this module into browser bundles. */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { capture, parsePreviewUrl } from './capture-preview.mjs';

const BUCKET = 'preview-videos';
const DEFAULTS = Object.freeze({ pageSize: 50, maxRows: 500, maxCaptures: 10, maxBytes: 25 * 1024 * 1024 });

export function eligible(row) {
  if (!row || typeof row.id !== 'string' || !row.id || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) return false;
  const deployment = row.data.project?.deployment;
  if (row.data.status !== 'published' || deployment?.status !== 'ready' || deployment.verified !== true || row.data.previewVideoUrl) return false;
  try { parsePreviewUrl(deployment.previewUrl); return true; } catch { return false; }
}

export function createAdapter(env = process.env, fetcher = fetch) {
  const raw = env.SUPABASE_URL;
  let base;
  try { base = new URL(raw); } catch { throw Error('Invalid Supabase URL'); }
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.pathname !== '/' || base.port || base.username || base.password || base.search || base.hash) throw Error('Invalid Supabase URL');
  const token = env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof token !== 'string' || !token.trim()) throw Error('Missing Supabase service role key');
  const headers = { apikey: token, Authorization: `Bearer ${token}` };
  async function request(path, options = {}) {
    const response = await fetcher(new URL(path, base), { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
    // Never include the HTTP response body: it may contain application data or secrets.
    if (!response.ok) throw Error(`Supabase ${options.method || 'GET'} failed (HTTP ${response.status})`);
    return response;
  }
  return {
    async list(after, limit) {
      const params = new URLSearchParams({ select: 'id,data', order: 'id.asc', limit: String(limit) });
      if (after) params.set('id', `gt.${after}`);
      const rows = await (await request(`/rest/v1/products?${params}`)).json();
      if (!Array.isArray(rows)) throw Error('Unexpected products response');
      return rows;
    },
    async upload(key, bytes) {
      await request(`/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'false' }, body: bytes,
      });
      return new URL(`/storage/v1/object/public/${BUCKET}/${encodeURIComponent(key)}`, base).href;
    },
    async compareAndSet(row, data) {
      // PostgreSQL jsonb equality matches the entire prior data document. The conditional
      // PATCH never overwrites an admin edit or another worker's video; 0 rows = conflict.
      const params = new URLSearchParams({ id: `eq.${row.id}`, data: `eq.${JSON.stringify(row.data)}`, select: 'id' });
      const updated = await (await request(`/rest/v1/products?${params}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ data }),
      })).json();
      if (!Array.isArray(updated) || updated.length > 1) throw Error('Unexpected conditional update response');
      return updated.length === 1;
    },
    async remove(key) {
      await request(`/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, { method: 'DELETE' });
    },
  };
}

export async function runOnce({ adapter, capture: capturePage = capture, tempDir } = {}, limits = {}) {
  if (!adapter) throw Error('Missing adapter');
  const { pageSize, maxRows, maxCaptures, maxBytes } = { ...DEFAULTS, ...limits };
  for (const [name, value] of Object.entries({ pageSize, maxRows, maxCaptures, maxBytes })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > (name === 'maxBytes' ? 25 * 1024 * 1024 : 10000)) throw Error(`Invalid ${name}`);
  }
  const summary = { scanned: 0, published: 0, conflicts: 0 };
  let after = '';
  const seen = new Set();
  while (summary.scanned < maxRows && summary.published + summary.conflicts < maxCaptures) {
    const requested = Math.min(pageSize, maxRows - summary.scanned);
    const batch = await adapter.list(after, requested);
    if (!Array.isArray(batch) || batch.length > requested || !batch.length) break;
    for (const row of batch) {
      if (typeof row.id !== 'string' || !row.id || (after && row.id <= after)) throw Error('Product pagination is not strictly increasing');
      after = row.id;
      summary.scanned++;
      if (seen.has(row.id) || !eligible(row)) continue;
      seen.add(row.id);
      const preview = parsePreviewUrl(row.data.project.deployment.previewUrl);
      const dir = await mkdtemp(join(tempDir || tmpdir(), 'labdits-preview-'));
      const output = join(dir, 'capture.mp4');
      let key;
      try {
        await capturePage({ preview, output, duration: 3, fps: 8, local: false });
        const size = (await stat(output)).size;
        if (!size || size > maxBytes) throw Error('Captured video size outside allowed range');
        const bytes = await readFile(output);
        key = `${randomUUID()}.mp4`;
        const url = await adapter.upload(key, bytes);
        // Preserve every unrelated data field; the adapter must implement atomic compare-and-set.
        const updated = await adapter.compareAndSet(row, { ...row.data, previewVideoUrl: url });
        if (updated) { summary.published++; key = undefined; }
        else { summary.conflicts++; await adapter.remove(key); key = undefined; }
      } catch (error) {
        if (key) await adapter.remove(key).catch(() => {});
        throw error;
      } finally { await rm(dir, { recursive: true, force: true }); }
      if (summary.published + summary.conflicts >= maxCaptures) break;
    }
    if (batch.length < requested) break;
  }
  return summary;
}

export function parseWorkerOptions(argv) {
  let watch = false; let interval = 60;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--watch' && !watch) watch = true;
    else if (argv[i] === '--once' && !watch) { /* default */ }
    else if (argv[i] === '--interval' && argv[i + 1] && /^\d+$/.test(argv[i + 1])) interval = Number(argv[++i]);
    else throw Error('Unknown worker argument');
  }
  if (!Number.isSafeInteger(interval) || interval < 30 || interval > 3600) throw Error('Interval must be 30–3600 seconds');
  return { watch, interval };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { watch, interval } = parseWorkerOptions(process.argv.slice(2));
    const adapter = createAdapter();
    do {
      try { console.log(JSON.stringify(await runOnce({ adapter }))); }
      catch { console.error('Preview worker cycle failed; inspect service availability and deployment status.'); process.exitCode = 1; }
      if (watch) await delay(interval * 1000);
    } while (watch);
  } catch { console.error('Preview worker configuration invalid. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY server-side.'); process.exitCode = 1; }
}
