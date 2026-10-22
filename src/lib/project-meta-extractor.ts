// Automatic project metadata & thumbnail extraction from uploaded files

export interface ExtractedProjectMeta {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  suggestedTags?: string[];
  theme?: string;
}

/**
 * Searches for image assets inside uploaded project files (PNG, JPG, WebP, SVG)
 * and generates a high-quality preview or SVG fallback banner.
 */
export async function extractProjectMetadata(files: File[]): Promise<ExtractedProjectMeta> {
  const meta: ExtractedProjectMeta = {};

  // 1. Try finding package.json for title and description
  const pkgFile = files.find((f) => f.name.endsWith("package.json"));
  if (pkgFile) {
    try {
      const text = await pkgFile.text();
      const parsed = JSON.parse(text);
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

  // 2. Try finding index.html for <title> and <meta name="description">
  const htmlFile = files.find((f) => f.name.endsWith("index.html") || f.name.endsWith("index_raw.html"));
  if (htmlFile && (!meta.title || !meta.description)) {
    try {
      const text = await htmlFile.text();
      if (!meta.title) {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]?.trim()) {
          meta.title = titleMatch[1].trim();
        }
      }
      if (!meta.description) {
        const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (descMatch && descMatch[1]?.trim()) {
          meta.description = descMatch[1].trim();
        }
      }
    } catch {
      // ignore parse error
    }
  }

  // 3. Search for existing screenshots or hero images in the project files
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
