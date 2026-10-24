import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreviewUrl, requestAllowed, parseOptions, browserEnvironment } from './capture-preview.mjs';

test('browser process never inherits worker service credentials', () => {
  const environment = browserEnvironment({ PATH: 'C:/ffmpeg', SystemRoot: 'C:/Windows', SUPABASE_SERVICE_ROLE_KEY: 'secret', HOME: '/private', AWS_SECRET_ACCESS_KEY: 'secret' });
  assert.equal(environment.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(environment.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(environment.HOME, undefined);
  assert.equal(environment.PATH, 'C:/ffmpeg');
});
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const execFileAsync = promisify(execFile);

test('accepts only HTTPS vercel.app subdomain without credentials, port, or fragment', () => {
  assert.equal(parsePreviewUrl('https://demo-123.vercel.app/products?q=1').origin, 'https://demo-123.vercel.app');
  for (const url of [
    'http://demo.vercel.app', 'https://vercel.app', 'https://demo.vercel.app.evil.com',
    'https://demo.vercel.app:8443', 'https://user:pass@demo.vercel.app',
    'https://127.0.0.1', 'https://demo.vercel.app/#secret', 'file:///etc/passwd',
    'https://demo.vercel.app\\@evil.com',
  ]) assert.throws(() => parsePreviewUrl(url), /preview URL/i, url);
});

test('local smoke mode accepts only loopback HTTP', () => {
  assert.equal(parsePreviewUrl('http://127.0.0.1:4200/', { local: true }).origin, 'http://127.0.0.1:4200');
  assert.throws(() => parsePreviewUrl('http://192.168.1.2/', { local: true }), /preview URL/i);
  assert.throws(() => parsePreviewUrl('https://demo.vercel.app/', { local: true }), /preview URL/i);
});

test('all network requests stay within exact validated origin', () => {
  const origin = parsePreviewUrl('https://demo.vercel.app/').origin;
  assert.equal(requestAllowed('https://demo.vercel.app/app.js', origin), true);
  for (const url of ['http://demo.vercel.app/', 'https://api.vercel.app/', 'https://demo.vercel.app.evil.org/', 'file:///etc/passwd', 'http://localhost/']) {
    assert.equal(requestAllowed(url, origin), false, url);
  }
});

test('CLI rejects unbounded duration and unsupported output', () => {
  assert.equal(parseOptions(['--url', 'https://demo.vercel.app/', '--output', 'movie.mp4', '--duration', '3']).duration, 3);
  assert.throws(() => parseOptions(['--url', 'https://demo.vercel.app/', '--output', 'movie.gif']), /output/i);
  assert.throws(() => parseOptions(['--url', 'https://demo.vercel.app/', '--output', 'movie.webm', '--duration', '999']), /duration/i);
});

test('local Chromium capture produces a playable MP4', async (t) => {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) return t.skip('ffmpeg not installed');
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>Capture smoke test</title><div style="height:1800px;background:linear-gradient(red,blue)">Actual webpage</div>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = mkdtempSync(join(tmpdir(), 'preview-video-test-'));
  try {
    const output = join(dir, 'capture.mp4');
    const { stdout } = await execFileAsync(process.execPath, ['capture-preview.mjs', '--local', '--url', `http://127.0.0.1:${server.address().port}/`, '--output', output, '--duration', '1', '--fps', '2'], { cwd: import.meta.dirname, timeout: 60000 });
    assert.equal(JSON.parse(stdout).frames, 2);
    assert.ok(statSync(output).size > 1000);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,nb_frames', '-of', 'json', output], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(JSON.parse(probe.stdout).streams[0].codec_name, 'h264');
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
