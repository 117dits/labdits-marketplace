import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdapter, eligible, runOnce, parseWorkerOptions } from './preview-worker.mjs';

const ready = (id, extras = {}) => ({ id, data: { name: 'unchanged', status: 'published', project: { deployment: { status: 'ready', verified: true, previewUrl: 'https://my-app.vercel.app/' } }, ...extras } });

test('policy accepts only verified ready direct Vercel deployments missing video', () => {
  assert.equal(eligible(ready('1', { status: 'published' })), true);
  // A verified deployment for a draft must not publish its capture yet.
  assert.equal(eligible(ready('draft', { status: 'draft' })), false);
  for (const data of [
    { project: { deployment: { status: 'building', verified: true, previewUrl: 'https://my-app.vercel.app' } } },
    { project: { deployment: { status: 'ready', verified: 'true', previewUrl: 'https://my-app.vercel.app' } } },
    { project: { deployment: { status: 'ready', verified: true, previewUrl: 'https://127.0.0.1/' } } },
    { project: { deployment: { status: 'ready', verified: true, previewUrl: 'https://evil.vercel.app.attacker.test' } } },
    { ...ready('1').data, previewVideoUrl: 'https://already.test/x.mp4' },
  ]) assert.equal(eligible({ id: '1', data }), false);
  assert.equal(eligible({ id: '', data: ready('1').data }), false);
});

test('worker never captures or uploads a draft product', async () => {
  let captures = 0;
  let uploads = 0;
  const result = await runOnce({
    adapter: {
      list: async () => [ready('draft', { status: 'draft' })],
      upload: async () => { uploads++; },
    },
    capture: async () => { captures++; },
  }, { maxRows: 1, maxCaptures: 1 });
  assert.deepEqual(result, { scanned: 1, published: 0, conflicts: 0 });
  assert.equal(captures, 0);
  assert.equal(uploads, 0);
});

test('worker discovers pages, captures bytes, preserves data, and skips duplicates', async () => {
  const rows = [ready('1'), ready('2'), ready('3', { previewVideoUrl: 'present' })];
  const uploaded = []; const captured = [];
  const adapter = {
    list: async (after, limit) => rows.filter(r => r.id > after).slice(0, limit).map(r => structuredClone(r)),
    upload: async (key, bytes) => { uploaded.push([key, bytes]); return `https://storage.test/${key}`; },
    compareAndSet: async (row, data) => {
      const target = rows.find(r => r.id === row.id);
      if (JSON.stringify(target.data) !== JSON.stringify(row.data)) return false;
      target.data = data; return true;
    },
    remove: async () => {},
  };
  const tempDir = await mkdtemp(join(tmpdir(), 'worker-test-'));
  try {
    const deps = { adapter, tempDir, capture: async ({ output, preview, local }) => {
      assert.equal(local, false); captured.push(preview.href); await writeFile(output, Buffer.from('real-test-bytes'));
    } };
    const first = await runOnce(deps, { pageSize: 1, maxRows: 10, maxCaptures: 2 });
    assert.deepEqual(first, { scanned: 2, published: 2, conflicts: 0 });
    assert.equal(uploaded.every(([key]) => /^[a-f0-9-]+\.mp4$/.test(key)), true);
    assert.deepEqual(captured, ['https://my-app.vercel.app/', 'https://my-app.vercel.app/']);
    assert.equal(uploaded.length, 2);
    assert.equal(uploaded[0][1].toString(), 'real-test-bytes');
    assert.equal(rows[0].data.name, 'unchanged');
    assert.equal(rows[0].data.project.deployment.status, 'ready');
    assert.equal(rows[0].data.previewVideoUrl.startsWith('https://storage.test/'), true);
    const second = await runOnce(deps, { pageSize: 2, maxRows: 10, maxCaptures: 2 });
    assert.equal(second.published, 0);
  } finally { await rm(tempDir, { recursive: true, force: true }); }
});

test('concurrent product edit rejects stale write and cleans orphan upload', async () => {
  const row = ready('1'); const removed = [];
  const tempDir = await mkdtemp(join(tmpdir(), 'worker-conflict-'));
  try {
    const result = await runOnce({ tempDir, capture: async ({ output }) => { await writeFile(output, 'video'); row.data = { ...row.data, name: 'edited' }; }, adapter: {
      list: async () => [structuredClone(row)], upload: async () => 'https://storage.test/video',
      compareAndSet: async (old) => JSON.stringify(row.data) === JSON.stringify(old.data),
      remove: async key => removed.push(key),
    } }, { maxRows: 1, maxCaptures: 1 });
    assert.equal(result.conflicts, 1);
    assert.equal(result.published, 0);
    assert.equal(row.data.name, 'edited');
    assert.equal(removed.length, 1);
  } finally { await rm(tempDir, { recursive: true, force: true }); }
});

test('refuses oversized captures without uploading', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'worker-size-')); let uploads = 0;
  try {
    await assert.rejects(runOnce({ tempDir: dir, adapter: { list: async () => [ready('1')], upload: async () => { uploads++; } }, capture: async ({ output }) => writeFile(output, Buffer.alloc(32)) }, { maxRows: 1, maxCaptures: 1, maxBytes: 16 }), /size/i);
    assert.equal(uploads, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('REST adapter uses service role, uploads MP4 bytes and conditional jsonb PATCH', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: url.href, init });
    return { ok: true, json: async () => url.pathname.endsWith('/products') ? (init.method === 'PATCH' ? [{ id: '1' }] : [ready('1')]) : null };
  };
  const adapter = createAdapter({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' }, fetcher);
  const [row] = await adapter.list('', 5);
  const bytes = Buffer.from('mp4 bytes');
  const url = await adapter.upload('some-key.mp4', bytes);
  assert.equal(url, 'https://abc.supabase.co/storage/v1/object/public/preview-videos/some-key.mp4');
  assert.equal(await adapter.compareAndSet(row, { ...row.data, previewVideoUrl: url }), true);
  await adapter.remove('some-key.mp4');
  assert.equal(calls.length, 4);
  assert.equal(calls.every(c => c.init.headers.Authorization === 'Bearer secret'), true);
  assert.equal(calls[1].init.body, bytes);
  assert.equal(calls[1].init.headers['x-upsert'], 'false');
  assert.equal(new URL(calls[2].url).searchParams.get('data'), `eq.${JSON.stringify(row.data)}`);
  assert.equal(calls[2].init.headers.Prefer, 'return=representation');
  assert.equal(calls[3].init.method, 'DELETE');
});

test('credentials and CLI options are strictly scoped', () => {
  assert.throws(() => createAdapter({ SUPABASE_URL: 'http://localhost:8000', SUPABASE_SERVICE_ROLE_KEY: 'secret' }), /Supabase URL/);
  assert.throws(() => createAdapter({ SUPABASE_URL: 'https://evil.test', SUPABASE_SERVICE_ROLE_KEY: 'secret' }), /Supabase URL/);
  assert.throws(() => createAdapter({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '' }), /service role key/);
  assert.deepEqual(parseWorkerOptions(['--once']), { watch: false, interval: 60 });
  assert.throws(() => parseWorkerOptions(['--local']), /argument/);
});
