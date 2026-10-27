#!/usr/bin/env node
/**
 * HyperFrames-powered demo preview video and thumbnail generator.
 * Captures live Vercel deployments and renders cinematic hover preview videos
 * with macOS browser frame and smooth camera zooms.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, copyFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';
import { parsePreviewUrl, requestAllowed, browserEnvironment } from './capture-preview.mjs';

function isPublicIp(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return false;
}

async function verifiedAddress(hostname, local) {
  if (local) return null;
  const addresses = await dns.lookup(hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw Error('Preview DNS resolved to a non-public address');
  }
  return addresses[0].address;
}

export function parseHyperFramesOptions(argv) {
  const args = { local: false, duration: 6, fps: 30 };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--local') { args.local = true; continue; }
    if (!['--url', '--output', '--thumbnail', '--name', '--slug', '--duration', '--fps'].includes(key) || !argv[i + 1]) {
      throw Error(`Unknown or missing argument: ${key}`);
    }
    const val = argv[++i];
    if (key === '--duration') args.duration = Number(val);
    else if (key === '--fps') args.fps = Number(val);
    else args[key.slice(2)] = val;
  }
  if (!args.url || !args.output) {
    throw Error('Required: --url HTTPS_PREVIEW --output FILE.mp4');
  }
  args.preview = parsePreviewUrl(args.url, { local: args.local });
  if (!/\.(mp4|webm)$/i.test(args.output)) {
    throw Error('Output must end with .mp4 or .webm');
  }
  if (!Number.isInteger(args.duration) || args.duration < 2 || args.duration > 20) {
    throw Error('Duration must be an integer from 2 to 20 seconds');
  }
  if (!Number.isInteger(args.fps) || args.fps < 12 || args.fps > 60) {
    throw Error('FPS must be an integer from 12 to 60');
  }
  args.name = args.name || 'Demo Aplikasi';
  args.slug = args.slug || 'demo';
  return args;
}

export function buildHyperFramesHtml({ slug, name, duration = 6 }) {
  const cleanSlug = slug.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'demo';
  const cleanName = name.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1280, height=720" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root {
        --ground: #0a0e17;
        --border: rgba(255, 255, 255, 0.12);
        --font-display: "Inter", system-ui, sans-serif;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 1280px;
        height: 720px;
        overflow: hidden;
        background: var(--ground);
        font-family: var(--font-display);
      }
      #root {
        position: relative;
        width: 1280px;
        height: 720px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0a0e17 75%);
        overflow: hidden;
      }
      .bg-glow {
        position: absolute;
        width: 900px;
        height: 500px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, transparent 70%);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      #window-stage {
        position: relative;
        width: 1080px;
        height: 620px;
        border-radius: 12px;
        background: #111827;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        will-change: transform;
      }
      .window-header {
        height: 38px;
        background: #1f2937;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 14px;
        flex-shrink: 0;
        z-index: 10;
      }
      .window-dots {
        display: flex;
        gap: 8px;
      }
      .dot {
        width: 11px;
        height: 11px;
        border-radius: 50%;
      }
      .dot-red { background: #ef4444; }
      .dot-yellow { background: #f59e0b; }
      .dot-green { background: #10b981; }
      .url-bar {
        flex: 1;
        max-width: 360px;
        height: 24px;
        margin: 0 auto;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 11px;
        color: #94a3b8;
      }
      .url-bar svg {
        width: 11px;
        height: 11px;
        fill: #64748b;
      }
      .window-viewport {
        position: relative;
        flex: 1;
        background: #ffffff;
        overflow: hidden;
      }
      #app-screenshot-carrier {
        position: absolute;
        top: 0;
        left: 0;
        width: 1080px;
        will-change: transform;
        transform-origin: 0 0;
      }
      #app-screenshot-carrier img {
        display: block;
        width: 100%;
        height: auto;
      }
      #feature-badge {
        position: absolute;
        bottom: 30px;
        right: 36px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        padding: 8px 16px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f8fafc;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        z-index: 20;
      }
      .pulse-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${duration}"
      data-width="1280"
      data-height="720"
    >
      <div class="bg-glow"></div>
      
      <div id="window-stage" class="clip" data-start="0" data-duration="${duration}" data-track-index="0">
        <div class="window-header">
          <div class="window-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <div class="url-bar" data-layout-ignore>
            <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <span>labdits.demo/${cleanSlug}</span>
          </div>
        </div>
        <div class="window-viewport">
          <div id="app-screenshot-carrier" data-layout-allow-overflow>
            <img src="assets/app-preview.png" alt="${cleanName}" />
          </div>
        </div>
      </div>

      <div id="feature-badge" class="clip" data-start="0" data-duration="${duration}" data-track-index="1">
        <span class="pulse-indicator"></span>
        <span>Demo Langsung: ${cleanName}</span>
      </div>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });

      // Window entrance - already slightly visible at 0s so first frame is not blank
      tl.fromTo(
        "#window-stage",
        { scale: 0.96, y: 10, opacity: 0.9 },
        { scale: 1.0, y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
        0
      );

      // Camera inspection: zoom into real app features
      tl.fromTo(
        "#app-screenshot-carrier",
        { y: 0, scale: 1 },
        { y: -50, scale: 1.15, duration: 2.2, ease: "power2.inOut" },
        1.0
      );

      // Smooth pan down to show secondary UI / metrics
      tl.to(
        "#app-screenshot-carrier",
        { y: -150, scale: 1.15, duration: 1.8, ease: "power2.inOut" },
        3.2
      );

      // Settle smoothly back for a loopable end
      tl.to(
        "#app-screenshot-carrier",
        { y: 0, scale: 1, duration: 0.8, ease: "power2.out" },
        5.0
      );

      // Badge entrance
      tl.fromTo(
        "#feature-badge",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.5)" },
        0.4
      );

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>`;
}

function getNode22Path() {
  // Check hermes toolchain for Node 22+
  const hermesNode26 = 'C:/Users/dits1/AppData/Local/hermes/tools/node-26.7.0-win32-x64';
  if (existsSync(join(hermesNode26, 'node.exe'))) {
    return hermesNode26;
  }
  return null;
}

export async function captureLiveScreenshot({ preview, outputPng, local = false, expectedName }) {
  const address = await verifiedAddress(preview.hostname, local);
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw Error('Playwright missing. Run: npm install --prefix scripts');
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-proxy-server',
      '--disable-extensions',
      '--disable-background-networking',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--disable-quic',
      ...(address ? [`--host-resolver-rules=MAP ${preview.hostname} ${address}`] : []),
    ],
    env: browserEnvironment(),
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      acceptDownloads: false,
      permissions: [],
      ignoreHTTPSErrors: false,
    });

    await context.route('**/*', (route) =>
      requestAllowed(route.request().url(), preview.origin) ? route.continue() : route.abort()
    );
    await context.routeWebSocket('**/*', (socket) => socket.close());

    const page = await context.newPage();
    page.on('dialog', (dialog) => { void dialog.dismiss().catch(() => {}); });

    const response = await page.goto(preview.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (!response || response.status() >= 400 || !requestAllowed(page.url(), preview.origin)) {
      throw Error('Preview navigation failed or redirected outside verified origin');
    }

    // Fail closed if the target URL serves a different app (e.g. a Wharf deployment
    // erroneously attached to FinanceFlow). Never publish the wrong product cover.
    if (expectedName) {
      const actual = await page.evaluate(() => `${document.title} ${document.body?.innerText.slice(0, 1200) || ''}`);
      const name = expectedName.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
      const visible = actual.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length < 3 || !visible.includes(name)) throw Error('Live demo does not identify as the expected product; verify the deployment mapping');
    }
    // Wait for animations and fonts to settle
    await page.waitForTimeout(2500);

    await page.screenshot({ path: outputPng, fullPage: false });
    return outputPng;
  } finally {
    await browser.close();
  }
}

export async function renderWithHyperFrames({ projectDir, outputMp4, fps = 30 }) {
  const nodeBinDir = getNode22Path();
  const env = { ...browserEnvironment() };
  if (nodeBinDir) {
    env.PATH = `${nodeBinDir};${env.PATH || env.Path || ''}`;
    env.Path = `${nodeBinDir};${env.PATH || env.Path || ''}`;
  }

  return new Promise((resolvePromise, reject) => {
    let cmd;
    let cmdArgs;
    let shell = false;

    if (nodeBinDir && existsSync(join(nodeBinDir, 'node.exe'))) {
      cmd = join(nodeBinDir, 'node.exe');
      cmdArgs = [
        join(nodeBinDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
        'hyperframes',
        'render',
        '--fps',
        String(fps),
        '-o',
        outputMp4,
      ];
    } else {
      cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      cmdArgs = ['hyperframes', 'render', '--fps', String(fps), '-o', outputMp4];
      shell = process.platform === 'win32';
    }

    const child = spawn(cmd, cmdArgs, {
      cwd: projectDir,
      env,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0 && existsSync(outputMp4)) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(`HyperFrames render exited ${code}: ${stderr || stdout}`));
      }
    });
  });
}

export async function generateHoverPreview(options) {
  const parsed = typeof options.preview === 'object' ? options : parseHyperFramesOptions(options);
  const outResolved = resolve(parsed.output);

  // 1. Create temporary directory for HyperFrames project
  const tempProjectDir = await mkdtemp(join(tmpdir(), 'labdits-hf-'));
  const assetsDir = join(tempProjectDir, 'assets');
  await mkdir(assetsDir, { recursive: true });

  const tempScreenshot = join(assetsDir, 'app-preview.png');

  try {
    // 2. Capture real screenshot from the live Vercel URL
    await captureLiveScreenshot({
      preview: parsed.preview,
      outputPng: tempScreenshot,
      local: parsed.local,
    });

    // 3. If thumbnail requested, copy screenshot to thumbnail destination
    if (parsed.thumbnail) {
      const thumbPath = resolve(parsed.thumbnail);
      await mkdir(join(thumbPath, '..'), { recursive: true });
      await copyFile(tempScreenshot, thumbPath);
    }

    // 4. Scaffold HyperFrames composition
    const htmlContent = buildHyperFramesHtml({
      slug: parsed.slug,
      name: parsed.name,
      duration: parsed.duration,
    });
    await writeFile(join(tempProjectDir, 'index.html'), htmlContent, 'utf8');

    const metaContent = JSON.stringify({
      id: `${parsed.slug}-preview-video`,
      name: parsed.name,
    }, null, 2);
    await writeFile(join(tempProjectDir, 'meta.json'), metaContent, 'utf8');

    // 5. Render composition to MP4
    await mkdir(join(outResolved, '..'), { recursive: true });
    await renderWithHyperFrames({
      projectDir: tempProjectDir,
      outputMp4: outResolved,
      fps: parsed.fps,
    });

    const fileStat = await stat(outResolved);
    return {
      success: true,
      output: outResolved,
      thumbnail: parsed.thumbnail ? resolve(parsed.thumbnail) : undefined,
      sizeBytes: fileStat.size,
      duration: parsed.duration,
      fps: parsed.fps,
    };
  } finally {
    // Clean up temporary workspace
    await rm(tempProjectDir, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const opts = parseHyperFramesOptions(process.argv.slice(2));
    const result = await generateHoverPreview(opts);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
