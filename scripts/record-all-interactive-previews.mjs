#!/usr/bin/env node
/**
 * Automated Interactive Video Preview Generator
 * Records real live Vercel deployments with simulated mouse navigation,
 * realistic feature clicking, and visual ripple feedback.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TMP_DIR = 'D:/hermes/cache/scratch/videos';
const OUT_DIR = 'D:/Projects/labdits-marketplace/public/previews';

async function transcodeToMp4(webmPath, mp4Path, trimStartSec = 0) {
  return new Promise((resolve, reject) => {
    const args = ['-y'];
    if (trimStartSec > 0.3) {
      args.push('-ss', trimStartSec.toFixed(2));
    }
    args.push(
      '-i', webmPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-preset', 'fast',
      '-crf', '22',
      '-movflags', '+faststart',
      '-an',
      mp4Path
    );
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg error (${code}): ${stderr.slice(-400)}`));
    });
  });
}

async function recordDashboard(browser, id) {
  const url = `https://labdits-${id}.vercel.app`;
  const mp4Path = join(OUT_DIR, `dash-${id}.mp4`);
  const thumbPath = join(OUT_DIR, `dash-${id}-thumb.jpg`);

  console.log(`\n========================================`);
  console.log(`[${id}/18] Recording interactive preview for: ${url}`);

  const contextStartTime = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: TMP_DIR,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    // Wait for initial animations, preloaders and layout to settle completely
    await page.waitForTimeout(2500);

    const readyTimestamp = Date.now();
    const trimStartSec = (readyTimestamp - contextStartTime) / 1000;

    // Save high-resolution thumbnail at the exact moment the video will start
    await page.screenshot({ path: thumbPath, quality: 95 });
    console.log(`  ✓ Saved thumbnail (trimmed offset ${trimStartSec.toFixed(2)}s): ${thumbPath}`);

    // Inject virtual cursor overlay
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor-overlay';
      cursor.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        transform: translate(640px, 360px);
        transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        will-change: transform;
      `;
      cursor.innerHTML = `
        <div id="demo-cursor-pointer" style="position: relative; width: 32px; height: 32px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.55)); transition: transform 0.15s ease;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5.5 3.2L18.8 12.8L12.5 14.2L16.2 21.5L13.8 22.7L10.1 15.4L5.5 19.5V3.2Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
        <div id="demo-cursor-ripple" style="
          position: absolute;
          top: 2px;
          left: 2px;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 3px solid #3b82f6;
          background: rgba(59, 130, 246, 0.35);
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.7);
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
          pointer-events: none;
        "></div>
      `;
      document.documentElement.appendChild(cursor);

      window.__demoMove = (x, y) => {
        const el = document.getElementById('demo-cursor-overlay');
        if (el) el.style.transform = `translate(${x}px, ${y}px)`;
      };

      window.__demoClick = () => {
        const ptr = document.getElementById('demo-cursor-pointer');
        const rip = document.getElementById('demo-cursor-ripple');
        if (ptr) {
          ptr.style.transform = 'scale(0.85)';
          setTimeout(() => { ptr.style.transform = 'scale(1)'; }, 150);
        }
        if (rip) {
          rip.style.transition = 'none';
          rip.style.transform = 'translate(-50%, -50%) scale(0)';
          rip.style.opacity = '1';
          requestAnimationFrame(() => {
            rip.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';
            rip.style.transform = 'translate(-50%, -50%) scale(1.6)';
            rip.style.opacity = '0';
          });
        }
      };
    });

    // Detect clickable interactive items
    const interactiveTargets = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
      return candidates.map(el => {
        const r = el.getBoundingClientRect();
        const text = el.innerText.trim().replace(/\s+/g, ' ');
        return {
          text: text.slice(0, 30),
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          w: Math.round(r.width),
          h: Math.round(r.height)
        };
      }).filter(e =>
        e.w >= 20 && e.h >= 20 &&
        e.x > 30 && e.x < 1250 &&
        e.y > 30 && e.y < 690 &&
        e.text.length >= 2 &&
        !e.text.toLowerCase().includes('keluar') &&
        !e.text.toLowerCase().includes('logout') &&
        !e.text.toLowerCase().includes('delete') &&
        !e.text.toLowerCase().includes('hapus')
      );
    });

    // Select 3 meaningful interactive targets (e.g. secondary nav, tertiary nav, home)
    let selectedTargets = [];
    if (interactiveTargets.length >= 3) {
      selectedTargets = [interactiveTargets[1], interactiveTargets[2], interactiveTargets[0]];
    } else if (interactiveTargets.length > 0) {
      selectedTargets = interactiveTargets.slice(0, 3);
    }

    console.log(`  Found ${interactiveTargets.length} interactive elements. Interacting with ${selectedTargets.length} targets.`);

    // Initial pause to appreciate overview
    await page.waitForTimeout(600);

    for (const target of selectedTargets) {
      console.log(`  → Moving cursor to: "${target.text}" (${target.x}, ${target.y})`);
      await page.evaluate(({ x, y }) => window.__demoMove(x, y), target);
      await page.waitForTimeout(450);

      await page.evaluate(() => window.__demoClick());
      try {
        await page.mouse.click(target.x, target.y);
      } catch {
        // safe fallback if element moved
      }
      console.log(`  ✓ Clicked "${target.text}"`);
      await page.waitForTimeout(1100);
    }

    // Gentle hover over main content card or chart
    await page.evaluate(() => window.__demoMove(700, 350));
    await page.waitForTimeout(700);

    const videoObj = page.video();
    await context.close();

    const webmPath = await videoObj.path();
    console.log(`  Transcoding WebM to faststart MP4 (trimming first ${trimStartSec.toFixed(2)}s)...`);
    await transcodeToMp4(webmPath, mp4Path, trimStartSec);
    console.log(`  ✓ Successfully generated ${mp4Path}`);

    // Cleanup raw WebM
    try { await unlink(webmPath); } catch {}

    return true;
  } catch (err) {
    console.error(`  ✗ Failed recording Dash ${id}:`, err.message);
    try { await context.close(); } catch {}
    return false;
  }
}

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  let ids = [];
  if (args.length > 0) {
    ids = args.map(Number).filter(n => n >= 1 && n <= 18);
  } else {
    ids = Array.from({ length: 18 }, (_, i) => i + 1);
  }

  console.log(`Starting interactive preview recording for dashboards: [${ids.join(', ')}]`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  for (const id of ids) {
    const ok = await recordDashboard(browser, id);
    results.push({ id, ok });
  }

  await browser.close();

  console.log('\n========================================');
  console.log('SUMMARY OF RECORDINGS:');
  for (const r of results) {
    console.log(`  Dashboard ${String(r.id).padStart(2, ' ')}: ${r.ok ? 'SUCCESS' : 'FAILED'}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
