// Automatic project metadata & thumbnail extraction from uploaded files

import { generateAIMetadata } from './ai-metadata';

export interface ExtractedProjectMeta {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  suggestedTags?: string[];
  theme?: string;
  category?: string;
  features?: string[];
}

/**
 * Searches for image assets inside uploaded project files (PNG, JPG, WebP, SVG)
 * and generates a high-quality preview or SVG fallback banner.
 */
export async function extractProjectMetadata(
  files: File[],
  entries?: { path: string; size: number; read?: (() => Promise<string>) | undefined }[],
): Promise<ExtractedProjectMeta> {
  const meta: ExtractedProjectMeta = {};
  // ZIP uploads are inspected via the already validated central-directory entries.
  const fromEntries = (basename: string) => entries?.find((entry) => entry.path.split('/').pop()?.toLowerCase() === basename && entry.size < 512 * 1024 && entry.read)?.read;
  const packageText = fromEntries('package.json');
  const htmlText = fromEntries('index.html') || fromEntries('index_raw.html');
  let pkg: Record<string, unknown> = {};

  // 1. Try finding package.json for title and description
  const pkgFile = files.find((f) => f.name.endsWith("package.json"));
  if (pkgFile || packageText) {
    try {
      const text = packageText ? await packageText() : await pkgFile!.text();
      const parsed = JSON.parse(text);
      pkg = parsed;
      if (parsed.name && typeof parsed.name === "string") {
        meta.title = formatProjectTitle(parsed.name);
      }
      if (parsed.description && typeof parsed.description === "string") {
        meta.description = parsed.description;
      }
    } catch {
      // ignore parse error
    }
  }

  // Prioritise customer-facing app content over starter package metadata.
  const htmlFile = files.find((f) => /(^|\/)index(?:_raw)?\.html$/i.test(f.webkitRelativePath || f.name));
  if ((htmlFile && htmlFile.size < 512 * 1024) || htmlText) {
    try {
      const text = htmlText ? await htmlText() : await htmlFile!.text();
      const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      const heading = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      const generic = /^(app|my app|website|template|starter|vite \+ react|react app|next app|dashboard|index)$/i;
      if (title && !generic.test(title)) meta.title = title.slice(0, 100);
      else if (heading && !generic.test(heading)) meta.title = heading.slice(0, 100);
      const descTag = text.match(/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*>/i)?.[0];
      const description = descTag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim();
      if (description) meta.description = description.slice(0, 500);
      const headings = [...text.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
        .map((match) => match[1]?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '')
        .filter((heading) => heading.length >= 5 && heading.length <= 80);
      meta.features = [...new Set(headings)].slice(0, 6);
    } catch {
      // ignore parse error
    }
  }
  if (meta.title && /^(app|my app|website|template|starter|vite \+ react|react app|next app|dashboard|index)$/i.test(meta.title)) delete meta.title;
  if (meta.description && /starter|template|boilerplate/i.test(meta.description)) delete meta.description;
  const dependencies = { ...(pkg['dependencies'] || {} as object), ...(pkg['devDependencies'] || {} as object) } as Record<string, unknown>;
  meta.suggestedTags = [
    dependencies['next'] && 'Next.js', dependencies['react'] && 'React', dependencies['vue'] && 'Vue',
    dependencies['svelte'] && 'Svelte', dependencies['typescript'] && 'TypeScript',
    (dependencies['tailwindcss'] || dependencies['@tailwindcss/vite']) && 'Tailwind CSS',
  ].filter((value): value is string => typeof value === 'string');
  const categoryText = `${meta.title || ''} ${meta.description || ''}`.toLowerCase();
  if (/kasir|point of sale|\bpos\b/.test(categoryText)) meta.category = 'Sistem POS & Kasir';
  else if (/toko online|e-commerce|ecommerce|keranjang belanja/.test(categoryText)) meta.category = 'E-Commerce';
  else if (/landing page|halaman arahan/.test(categoryText)) meta.category = 'Landing Page';
  else if (/dashboard|admin panel/.test(categoryText)) meta.category = 'Dashboard Admin';
  else if (/saas|langganan aplikasi/.test(categoryText)) meta.category = 'Aplikasi SaaS';
  else if (/website (bisnis|perusahaan)|company profile/.test(categoryText)) meta.category = 'Website Bisnis';
  else meta.category = 'Aplikasi Kustom';
  if (!meta.features?.length) meta.features = [];
  // Code-only SPA builds may have a generic index.html. Read visible labels only,
  // never execute the uploaded app to invent marketing copy.
  if (!meta.description) {
    const source = files.find((f) => /\/(?:src\/)?(?:app|page|home|index)\.(tsx|jsx|html)$/i.test(f.webkitRelativePath || '') && f.size < 128 * 1024);
    if (source) {
      try {
        const text = await source.text();
        const heading = text.match(/<h1[^>]*>([^<{]{8,120})<\/h1>/i)?.[1]?.trim();
        const paragraph = text.match(/<p[^>]*>([^<{]{20,260})<\/p>/i)?.[1]?.trim();
        if (heading && !meta.title) meta.title = heading;
        if (paragraph) meta.description = paragraph;
      } catch { /* No reliable visible copy. */ }
    }
  }

  // 3. AI enhancement for missing, sparse or generic metadata
  if (!meta.title || !meta.description || !meta.features?.length) {
    const ai = await generateAIMetadata({
      rawTitle: meta.title,
      rawDescription: meta.description,
      files: files.map((f) => f.webkitRelativePath || f.name),
      headings: meta.features,
      packageJson: pkg,
      category: meta.category,
    });
    if (!meta.title) meta.title = ai.title;
    if (!meta.description) meta.description = ai.description;
    if (!meta.category || meta.category === 'Aplikasi Kustom') meta.category = ai.category;
    if (!meta.features || !meta.features.length) meta.features = ai.features;
    if (!meta.suggestedTags || !meta.suggestedTags.length) meta.suggestedTags = ai.stack;
  }

  // 4. Search for existing screenshots or hero images in the project files
  const imageFiles = files.filter((f) => {
    const n = f.name.toLowerCase();
    return (
      (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp")) &&
      !n.includes("favicon") &&
      !n.includes("node_modules") &&
      !n.includes(".git") &&
      f.size < 5 * 1024 * 1024
    );
  });

  // Prioritize hero, preview, thumbnail, screenshot, or banner
  const bestImage = imageFiles.find((f) => {
    const n = f.name.toLowerCase();
    return n.includes("hero") || n.includes("preview") || n.includes("screenshot") || n.includes("thumbnail") || n.includes("banner");
  }) || imageFiles[0];

  if (bestImage) {
    try {
      const base64 = await fileToBase64(bestImage);
      meta.thumbnailUrl = base64;
    } catch {
      // fallback to svg banner below
    }
  }

  // 4. If no valid image found, generate an artistic SVG thumbnail
  if (!meta.thumbnailUrl && meta.title) {
    meta.thumbnailUrl = generateSvgThumbnail(meta.title, meta.description);
  }

  return meta;
}

function formatProjectTitle(raw: string): string {
  return raw
    .replace(/^@[\w-]+\//, "")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function generateSvgThumbnail(title: string, subtitle?: string): string {
  const cleanTitle = title.replace(/[<>&"]/g, "");
  const cleanSub = (subtitle || "Modern Web Application").slice(0, 60).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f1117" />
      <stop offset="50%" stop-color="#181a24" />
      <stop offset="100%" stop-color="#0a0c10" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="60" />
    </filter>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)" />
  <circle cx="200" cy="200" r="180" fill="#3b82f6" opacity="0.15" filter="url(#blur)" />
  <circle cx="1000" cy="600" r="220" fill="#8b5cf6" opacity="0.15" filter="url(#blur)" />
  <g transform="translate(100, 260)">
    <rect x="0" y="0" width="1000" height="280" rx="16" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.08" />
    <circle cx="40" cy="40" r="8" fill="#ef4444" />
    <circle cx="65" cy="40" r="8" fill="#eab308" />
    <circle cx="90" cy="40" r="8" fill="#22c55e" />
    <text x="40" y="140" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="700" letter-spacing="-1">${cleanTitle}</text>
    <text x="40" y="195" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24">${cleanSub}</text>
    <rect x="40" y="235" width="160" height="6" rx="3" fill="url(#glow)" />
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
