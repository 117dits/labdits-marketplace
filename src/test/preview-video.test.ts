import { describe, expect, it, vi } from 'vitest';
import { discoverPreviewVideo, uploadPreviewVideo } from '@/lib/preview-video';

const mp4Bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);

describe('uploaded project preview video', () => {
  it('selects a real web video in the project rather than a placeholder', async () => {
    const file = new File([webmBytes], 'preview.webm', { type: 'video/webm' });
    expect(await discoverPreviewVideo([file])).toBe(file);
    expect(await discoverPreviewVideo([new File(['source'], 'index.html')])).toBeNull();
  });

  it('accepts a valid video signature even when the OS gives no MIME and rejects impostors', async () => {
    const mp4 = new File([mp4Bytes], 'preview.mp4');
    const webm = new File([webmBytes], 'demo.webm');
    expect(await discoverPreviewVideo([mp4])).toBe(mp4);
    expect(await discoverPreviewVideo([webm])).toBe(webm);
    expect(await discoverPreviewVideo([new File(['not a video'], 'preview.mp4', { type: 'video/mp4' })])).toBeNull();
    expect(await discoverPreviewVideo([new File(['not a video'], 'preview.webm', { type: 'video/webm' })])).toBeNull();
    expect(await discoverPreviewVideo([new File([webmBytes], 'preview.mp4', { type: 'video/mp4' })])).toBeNull();
    expect(await discoverPreviewVideo([new File([mp4Bytes], 'preview.webm', { type: 'video/webm' })])).toBeNull();
    expect(await discoverPreviewVideo([new File([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79])], 'preview.mp4')])).toBeNull();
    expect(await discoverPreviewVideo([new File([new Uint8Array([0x1a, 0x45, 0xdf])], 'preview.webm')])).toBeNull();
  });
  it('ignores videos in dependencies and rejects oversized files', async () => {
    const ignored = new File(['x'], 'preview.mp4', { type: 'video/mp4' });
    Object.defineProperty(ignored, 'webkitRelativePath', { value: 'project/node_modules/preview.mp4' });
    expect(await discoverPreviewVideo([ignored])).toBeNull();
    const oversized = new File(['x'], 'preview.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });
    expect(await discoverPreviewVideo([oversized])).toBeNull();
  });

  it('uploads actual bytes to restricted storage and returns its public URL only on success', async () => {
    const file = new File([mp4Bytes], 'demo.mp4', { type: 'video/mp4' });
    const upload = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://storage.example/storage/v1/object/public/preview-videos/p/uuid.mp4' } }));
    const from = vi.fn(() => ({ upload, getPublicUrl }));
    const client = { from };
    const url = await uploadPreviewVideo(file, 'product-1', client as never);
    expect(url).toMatch(/^https:\/\/storage\.example\/storage\/v1\/object\/public\/preview-videos\//);
    expect(from).toHaveBeenCalledWith('preview-videos');
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^product-1\/[\da-f-]+\.mp4$/), file, { contentType: 'video/mp4', upsert: false });
  });

  it('refuses to persist a URL when storage fails', async () => {
    const file = new File([webmBytes], 'demo.webm', { type: 'video/webm' });
    const client = { from: () => ({ upload: async () => ({ error: new Error('denied') }) }) };
    await expect(uploadPreviewVideo(file, 'product-1', client as never)).rejects.toThrow('denied');
  });
});
