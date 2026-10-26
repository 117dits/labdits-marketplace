# Local preview-video capture

`capture-preview.mjs` is the manual local capture command. `preview-worker.mjs` is a server-only, automatic polling worker that discovers verified, ready deployments in Supabase `public.products` without entering a URL. It is not a hosted API or queue. Never import the worker into frontend code. Do not run untrusted uploads with access to sensitive local files; run in a disposable network-restricted worker for adversarial HTML.

Requires Node 20+, `ffmpeg` and `ffprobe` on `PATH`, and installed Playwright Chromium. From repository root:

```sh
cd scripts
npm install
npx playwright install chromium
npm test
node capture-preview.mjs --url 'https://YOUR-VERIFIED-DEPLOYMENT.vercel.app/' --output './preview.mp4' --duration 6 --fps 12
# Alternatively: --output './preview.webm'
```

Do not pass a localhost URL in production. A separate smoke-test switch accepts **only** HTTP localhost/127.0.0.1/[::1]:

```sh
node capture-preview.mjs --local --url 'http://127.0.0.1:4173/' --output './local.webm' --duration 2
```

The script accepts direct HTTPS `*.vercel.app` hosts only (no credentials, custom port, fragment, or cross-origin redirects). It checks DNS for public IPv4 and pins Chromium to that address; requests outside the exact verified origin are aborted, WebSockets are closed, service workers and downloads are disabled, and a fresh browser context is used. Cross-origin fonts, scripts, images, and APIs will not render/work. A network sandbox is still recommended: browser-level interception is not an OS security boundary. Duration (1–20 seconds) and FPS (1–24) describe nominal encoded output time, not a strict wall-clock limit; output must not already exist. Screenshots are sampled from the real rendered page and piped to ffmpeg as H.264 MP4 or VP9 WebM. The worker scrolls slowly to demonstrate the page and prints JSON with the output path when encoding finishes.

## Automatic after-deployment worker

Apply `supabase/migrations/20261023_preview_videos.sql` first (public 25 MiB video bucket). In an isolated server/container, set `SUPABASE_URL=https://YOUR_PROJECT.supabase.co` and `SUPABASE_SERVICE_ROLE_KEY` **only as server-side environment variables** (never browser/VITE variables or CLI arguments). Start `npm run preview:watch` in `scripts/` under a process supervisor; or run `npm run preview:once` periodically (e.g. scheduler every minute). `node preview-worker.mjs --watch --interval 60` sets the polling interval in seconds (30–3600). Deployment readiness is discovered automatically from `products.data.project.deployment`: only products with `data.status === 'published'`, deployment `status === 'ready'`, `verified === true`, missing `data.previewVideoUrl`, and direct HTTPS `*.vercel.app` URLs are eligible. Draft products are not captured or uploaded to public storage. Do not grant user-controlled URLs direct access to this process.

Each cycle scans at most 500 products, captures at most 10 videos sequentially (3 seconds × 8 FPS), rejects zero/oversized outputs, and uploads immutable randomly named MP4 objects. A conditional PostgreSQL JSONB equality filter on the full original `data` document makes the final PATCH fail closed if the row changed during capture; conflicting orphan objects are removed. If cleanup fails, investigate abandoned storage objects. The worker uses the service-role key for Supabase requests; Chromium and ffmpeg receive an environment allowlist without that key. Do **not** run this with access to cloud metadata endpoints, internal services, or host files: enforce egress and filesystem sandboxing outside Playwright too. Capture URL policy and same-origin request interception are not a full security boundary. A process supervisor must restart a crashed worker; cycles report aggregate counts, not row contents or secrets.

## HyperFrames-powered cinematic hover previews

To create a high-fidelity cinematic video of the deployed app (encased in a macOS-styled browser window with smooth camera zoom and pan over key UI features), use `render-hyperframes-preview.mjs`:

```sh
node render-hyperframes-preview.mjs \
  --url 'https://YOUR-DEPLOYMENT.vercel.app/' \
  --name 'Nama Produk' \
  --slug 'slug-produk' \
  --output './public/previews/slug.mp4' \
  --thumbnail './public/previews/slug-thumb.png' \
  --duration 5 \
  --fps 24
```

Features:
- **Real live capture**: Connects to the verified Vercel preview URL, waits for animations and fonts to settle, and captures the actual deployed application.
- **Mac-style browser frame**: Encases the application in a sleek browser frame with window controls and security pill indicator.
- **GSAP motion choreography**: Smooth zoom-in onto dashboard cards/metrics, pan over key application flows, and gentle return to full overview for seamless looping.
- **Thumbnail generation**: Optionally exports the real high-res screenshot directly as the product's primary card image (`--thumbnail`), completely replacing generic SVG fallback graphics with genuine app screenshots.
- **Deterministic MP4 rendering**: HyperFrames uses seekable timeline rendering with headless Chrome and FFmpeg, outputting lightweight, crystal-clear 1080p/720p H.264 MP4 videos optimized for card hover interactions.
