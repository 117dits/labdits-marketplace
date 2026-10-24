#!/usr/bin/env node
/** Isolated, local-only capture of a validated public Vercel deployment. */
import dns from 'node:dns/promises';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function parsePreviewUrl(input, { local = false } = {}) {
  try {
    if (typeof input !== 'string' || !/^https?:\/\//i.test(input) || /[\\\s]/.test(input)) throw Error();
    const url = new URL(input);
    const validHost = local
      ? url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      : url.protocol === 'https:' && /^[a-z0-9-]+\.vercel\.app$/.test(url.hostname);
    if (!validHost || url.username || url.password || url.hash || (!local && url.port)) throw Error();
    return url;
  } catch {
    throw new Error('Invalid preview URL: use HTTPS on a direct *.vercel.app host (or --local for loopback HTTP).');
  }
}

export function requestAllowed(input, origin) {
  try {
    const url = new URL(input);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function parseOptions(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--local') { args.local = true; continue; }
    if (!['--url', '--output', '--duration', '--fps'].includes(key) || !argv[i + 1] || args[key.slice(2)] !== undefined) throw Error(`Unknown, missing, or duplicate argument: ${key}`);
    args[key.slice(2)] = argv[++i];
  }
  if (!args.url || !args.output) throw Error('Required: --url HTTPS_PREVIEW --output FILE.mp4|FILE.webm');
  args.preview = parsePreviewUrl(args.url, { local: args.local });
  if (!/\.(mp4|webm)$/i.test(args.output)) throw Error('Output must end with .mp4 or .webm');
  args.duration = args.duration === undefined ? 6 : Number(args.duration);
  args.fps = args.fps === undefined ? 12 : Number(args.fps);
  if (!Number.isInteger(args.duration) || args.duration < 1 || args.duration > 20) throw Error('Duration must be an integer from 1 to 20 seconds');
  if (!Number.isInteger(args.fps) || args.fps < 1 || args.fps > 24) throw Error('FPS must be an integer from 1 to 24');
  return args;
}

function isPublicIp(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 && c === 0 || a === 198 && (b === 18 || b === 19) || a === 192 && b === 0 && c === 2 || a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113);
  }
  // Only route through verified public IPv4; IPv6 literals and IPv6 private ranges cannot be pinned here.
  return false;
}

export function browserEnvironment(source = process.env) {
  // A rendered uploaded page is untrusted. Never expose worker/service credentials
  // through browser or encoder child-process environments.
  const allowed = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LOCALAPPDATA', 'LANG', 'LC_ALL'];
  return Object.fromEntries(allowed.filter((key) => typeof source[key] === 'string').map((key) => [key, source[key]]));
}

async function verifiedAddress(hostname, local) {
  if (local) return null;
  const addresses = await dns.lookup(hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) throw Error('Preview DNS resolved to a non-public address');
  return addresses[0].address;
}

function ffmpegCheck() {
  const check = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 3000 });
  if (check.error || check.status !== 0) throw Error('ffmpeg executable not available on PATH');
}

async function writeFrame(stream, bytes) {
  if (!stream.write(bytes)) await new Promise((resolve, reject) => {
    stream.once('drain', resolve);
    stream.once('error', reject);
  });
}

export async function capture(args) {
  ffmpegCheck();
  const output = resolve(args.output);
  if (existsSync(output)) throw Error(`Output already exists: ${output}`);
  const address = await verifiedAddress(args.preview.hostname, args.local);
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw Error('Playwright missing. Run: npm install --prefix scripts'); }
  // No browser profile, inherited proxies, extension access, service workers or cross-origin network.
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-proxy-server', '--disable-extensions', '--disable-background-networking',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disable-quic',
      ...(address ? [`--host-resolver-rules=MAP ${args.preview.hostname} ${address}`] : []),
    ],
    // Chromium must not inherit the worker's service-role key or other host secrets.
    env: browserEnvironment(),
  });
  let ffmpeg;
  try {
    const context = await browser.newContext({
      viewport: { width: 960, height: 600 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', acceptDownloads: false,
      permissions: [], ignoreHTTPSErrors: false,
    });
    await context.route('**/*', (route) => requestAllowed(route.request().url(), args.preview.origin) ? route.continue() : route.abort());
    // Playwright HTTP routing does not intercept WebSocket handshakes.
    await context.routeWebSocket('**/*', (socket) => socket.close());
    const page = await context.newPage();
    page.on('dialog', (dialog) => { void dialog.dismiss().catch(() => {}); });
    const response = await page.goto(args.preview.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!response || response.status() >= 400 || !requestAllowed(page.url(), args.preview.origin)) throw Error('Preview navigation failed or redirected outside the verified origin');
    await page.waitForTimeout(800);
    const isMp4 = output.toLowerCase().endsWith('.mp4');
    const codec = isMp4 ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'] : ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '800k'];
    ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-f', 'image2pipe', '-framerate', String(args.fps), '-vcodec', 'png', '-i', 'pipe:0', '-an', ...codec, output], { stdio: ['pipe', 'ignore', 'pipe'], env: browserEnvironment() });
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000); });
    const finish = new Promise((res, rej) => {
      ffmpeg.once('error', rej);
      ffmpeg.once('close', (code) => code === 0 ? res() : rej(Error(`ffmpeg exited ${code}: ${stderr}`)));
    });
    // Sample actual browser frames while naturally scrolling. Video duration equals sampled frame count / FPS.
    const frames = args.duration * args.fps;
    for (let i = 0; i < frames; i++) {
      if (!requestAllowed(page.url(), args.preview.origin)) throw Error('Page navigated away from verified origin');
      if (i > 0) await page.mouse.wheel(0, 12);
      const frame = await page.screenshot({ type: 'png', animations: 'allow', timeout: 10000 });
      await writeFrame(ffmpeg.stdin, frame);
      if (i < frames - 1) await delay(Math.max(0, 1000 / args.fps - 10));
    }
    ffmpeg.stdin.end();
    await finish;
    console.log(JSON.stringify({ output, source: args.preview.origin, frames, duration: args.duration, fps: args.fps }));
  } catch (error) {
    if (ffmpeg) { ffmpeg.stdin.destroy(); ffmpeg.kill(); }
    throw error;
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await capture(parseOptions(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
