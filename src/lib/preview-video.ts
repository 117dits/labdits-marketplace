import { supabase } from '@/integrations/supabase/client';

/** Only a supplied video is published. No synthetic clips or unverified preview URL. */
export const PREVIEW_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const formats: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm' };
const ignored = /(^|\/)(?:node_modules|\.git|\.next|dist|build|test-results|artifacts)\//i;

export async function discoverPreviewVideo(files: File[]): Promise<File | null> {
  const candidates = await Promise.all(files.map(async file => {
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const extension = path.toLowerCase().match(/\.(mp4|webm)$/)?.[0];
    if (!extension || ignored.test(path) || (file.type && file.type !== formats[extension]) ||
        file.size === 0 || file.size > PREVIEW_VIDEO_MAX_BYTES) return null;

    const header = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file.slice(0, extension === '.mp4' ? 8 : 4));
    });
    const bytes = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const valid = extension === '.mp4'
      ? header.length === 8 && bytes.getUint32(0) >= 8 &&
        bytes.getUint8(4) === 0x66 && bytes.getUint8(5) === 0x74 && bytes.getUint8(6) === 0x79 && bytes.getUint8(7) === 0x70
      : header.length === 4 && bytes.getUint8(0) === 0x1a && bytes.getUint8(1) === 0x45 && bytes.getUint8(2) === 0xdf && bytes.getUint8(3) === 0xa3;
    return valid ? file : null;
  }));
  const priority = (file: File) => /(?:^|\/)(?:preview|demo|teaser|screencast)\.(mp4|webm)$/i.test(file.webkitRelativePath || file.name) ? 0 : 1;
  return candidates.filter((file): file is File => file !== null)
    .sort((a, b) => priority(a) - priority(b) || a.size - b.size)[0] ?? null;
}

/** Call after admin sign-in; the bucket policy, not this client, authorizes writes. */
export async function uploadPreviewVideo(file: File, productId: string, client: Pick<typeof supabase, 'storage'>['storage'] = supabase.storage): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(productId)) throw new Error('Invalid product ID');
  if (await discoverPreviewVideo([file]) !== file) throw new Error('Use a valid MP4/WebM video up to 25 MB.');
  const extension = file.name.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm';
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
  const bucket = client.from('preview-videos');
  const { error } = await bucket.upload(path, file, { contentType: extension === 'mp4' ? 'video/mp4' : 'video/webm', upsert: false });
  if (error) throw error;
  const url = bucket.getPublicUrl(path).data.publicUrl;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Storage did not return a public HTTPS video URL.');
  return url;
}
