import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdapter, eligible, runOnce, parseWorkerOptions } from './preview-worker.mjs';

const ready = (id, extras = {}) => ({ id, name: 'Demo', status: 'published', data: { name: 'unchanged', project: { deployment: { status: 'ready', verified: true, previewUrl: 'https://my-app.vercel.app/' } }, ...extras } });

const screenshot = async ({ outputPng, expectedName }) => { assert.equal(expectedName, 'Demo'); await writeFile(outputPng, Buffer.from('png-test-bytes')); };

test('policy accepts only published verified deployments with missing assets', () => {
  assert.equal(eligible(ready('1')), true);
  assert.equal(eligible(ready('1', { previewVideoUrl: 'https://already.test/x.mp4' })), true);
  assert.equal(eligible(ready('1', { previewVideoUrl: 'present', previewThumbnailUrl: 'present' })), false);
  assert.equal(eligible({ ...ready('draft'), status: 'draft' }), false);
  for (const deployment of [
    { status: 'building', verified: true, previewUrl: 'https://my-app.vercel.app' },
    { status: 'ready', verified: 'true', previewUrl: 'https://my-app.vercel.app' },
    { status: 'ready', verified: true, previewUrl: 'https://127.0.0.1/' },
    { status: 'ready', verified: true, previewUrl: 'https://evil.vercel.app.attacker.test' },
  ]) assert.equal(eligible(ready('1', { project: { deployment } })), false);
  assert.equal(eligible({ id: '', status: 'published', data: ready('1').data }), false);
});

test('worker never captures or uploads a draft product', async () => {
  let captures = 0;
  let uploads = 0;
  const result = await runOnce({
    adapter: {
      list: async () => [{ ...ready('draft'), status: 'draft' }],
      upload: async () => { uploads++; },
    },
    capture: async () => { captures++; },
  }, { maxRows: 1, maxCaptures: 1 });
  assert.deepEqual(result, { scanned: 1, published: 0, conflicts: 0 });
  assert.equal(captures, 0);
  assert.equal(uploads, 0);
});

test('worker captures screenshot and video, preserves existing product fields and skips complete rows', async () => {
  const rows = [ready('1'), ready('2', { previewVideoUrl: 'https://existing/video' }), ready('3', { previewVideoUrl: 'present', previewThumbnailUrl: 'present' })];
  const uploads = [];
  const adapter = {
    list: async (after, limit) => rows.filter(r => r.id > after).slice(0, limit).map(r => structuredClone(r)),
    upload: async (bucket, key, bytes) => { uploads.push([bucket, key, bytes]); return `https://storage.test/${bucket}/${key}`; },
    publish: async (row, patch) => {
      const target = rows.find(r => r.id === row.id);
      if (JSON.stringify(target.data) !== JSON.stringify(row.data)) return false;
      Object.assign(target.data, patch); return true;
    },
    remove: async () => { throw Error('No cleanup on success'); },
  };
  const dir = await mkdtemp(join(tmpdir(), 'worker-test-'));
  try {
    const deps = { adapter, tempDir: dir, screenshot, capture: async ({ output }) => writeFile(output, Buffer.from('real-test-bytes')) };
    assert.deepEqual(await runOnce(deps, { pageSize: 1, maxRows: 10, maxCaptures: 2 }), { scanned: 2, published: 2, conflicts: 0 });
    assert.deepEqual(uploads.map(([bucket]) => bucket), ['preview-images', 'preview-videos', 'preview-images']);
    assert.equal(rows[0].data.name, 'unchanged');
    assert.equal(rows[1].data.previewVideoUrl, 'https://existing/video');
    assert.equal(rows[0].data.previewThumbnailUrl.startsWith('https://storage.test/preview-images/'), true);
    assert.equal((await runOnce(deps, { pageSize: 3, maxRows: 10, maxCaptures: 2 })).published, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('concurrent product edit rejects stale write and cleans orphan uploads', async () => {
  const row = ready('1'); const removed = [];
  const tempDir = await mkdtemp(join(tmpdir(), 'worker-conflict-'));
  try {
    const result = await runOnce({ tempDir, screenshot, capture: async ({ output }) => { await writeFile(output, 'video'); row.data = { ...row.data, name: 'edited' }; }, adapter: {
      list: async () => [structuredClone(row)], upload: async (bucket, key) => `https://storage.test/${bucket}/${key}`,
      publish: async old => JSON.stringify(row.data) === JSON.stringify(old.data),
      remove: async (bucket, key) => removed.push([bucket, key]),
    } }, { maxRows: 1, maxCaptures: 1 });
    assert.equal(result.conflicts, 1);
    assert.equal(result.published, 0);
    assert.equal(row.data.name, 'edited');
    assert.equal(removed.length, 2);
  } finally { await rm(tempDir, { recursive: true, force: true }); }
});

test('refuses oversized captures and cleans uploaded screenshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'worker-size-')); const removed = [];
  try {
    await assert.rejects(runOnce({ tempDir: dir, screenshot, capture: async ({ output }) => writeFile(output, Buffer.alloc(32)), adapter: {
      list: async () => [ready('1')], upload: async (bucket, key) => `https://storage.test/${bucket}/${key}`,
      remove: async (bucket, key) => removed.push([bucket, key]),
    } }, { maxRows: 1, maxCaptures: 1, maxBytes: 16 }), /size/i);
    assert.equal(removed.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('REST adapter posts media patch in body without embedding project JSON in URI', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: url.href, init });
    return { ok: true, json: async () => url.pathname.endsWith('/products') ? [ready('1')] : true };
  };
  const adapter = createAdapter({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' }, fetcher);
  const [row] = await adapter.list('', 5);
  const url = await adapter.upload('preview-images', 'some-key.png', Buffer.from('png'));
  assert.equal(url, 'https://abc.supabase.co/storage/v1/object/public/preview-images/some-key.png');
  assert.equal(await adapter.publish(row, { previewThumbnailUrl: url }), true);
  await adapter.remove('preview-images', 'some-key.png');
  assert.equal(calls.length, 4);
  assert.equal(calls.every(c => c.init.headers.Authorization === 'Bearer secret'), true);
  assert.equal(calls[1].init.headers['Content-Type'], 'image/png');
  assert.equal(new URL(calls[2].url).pathname, '/rest/v1/rpc/publish_preview_assets');
  assert.equal(calls[2].url.includes(row.data.name), false);
  assert.deepEqual(JSON.parse(calls[2].init.body).asset_patch, { previewThumbnailUrl: url });
});

test('credentials and CLI options are strictly scoped', () => {
  assert.throws(() => createAdapter({ SUPABASE_URL: 'http://localhost:8000', SUPABASE_SERVICE_ROLE_KEY: 'secret' }), /Supabase URL/);
  assert.throws(() => createAdapter({ SUPABASE_URL: 'https://evil.test', SUPABASE_SERVICE_ROLE_KEY: 'secret' }), /Supabase URL/);
  assert.throws(() => createAdapter({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '' }), /service role key/);
  assert.deepEqual(parseWorkerOptions(['--once']), { watch: false, interval: 60 });
  assert.throws(() => parseWorkerOptions(['--local']), /argument/);
});
