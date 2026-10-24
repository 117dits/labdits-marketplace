import { describe, expect, it } from 'vitest';
import { seedProducts } from '@/data/products';
import { publishReadiness } from '@/lib/publish-readiness';
import { publicPreviewUrl, resolvePublicDemo, shouldShowBundledDemo } from '@/lib/public-demo';
import type { Product } from '@/types';

const product = (patch: Partial<Product> = {}): Product => ({
  ...seedProducts[0]!,
  id: 'uploaded-1',
  slug: 'dashboardkeren',
  status: 'draft',
  demoMode: 'iframe',
  demoUrl: 'https://demo.example.com/dashboardkeren',
  project: {
    sourceType: 'zip', files: [{ path: 'index.html', size: 1 }], totalSize: 1,
    uploadId: 'upload-1', localStatus: 'pending',
  },
  ...patch,
});

describe('public demo selection', () => {
  it('uses a public HTTPS external demo even when uploaded source is awaiting build', () => {
    const p = product();
    expect(resolvePublicDemo(p)).toBe('https://demo.example.com/dashboardkeren');
    expect(publishReadiness(p)).toEqual([]);
  });
  it('rejects loopback disguises, private IPs and preview on catalog origin', () => {
    for (const url of ['https://127.1/', 'https://0177.0.0.1/', 'https://[::1]/', 'https://169.254.1.1/', 'https://10.10.0.1/', 'https://labdits.lovable.app.evil.invalid/']) {
      expect(publicPreviewUrl(url)).toBeNull();
    }
  });
  it('rejects localhost, credentials, non-HTTPS, and a self-embedding catalog page', () => {
    for (const demoUrl of [
      'http://demo.example.com/', 'https://localhost:8787/', 'https://127.0.0.1:8787/',
      'https://user:pass@demo.example.com/', 'javascript:alert(1)',
      'https://labdits.lovable.app/dashboardkeren',
    ]) {
      const p = product({ demoUrl });
      expect(resolvePublicDemo(p)).toBeNull();
      expect(publishReadiness(p).length).toBeGreaterThan(0);
    }
  });
  it('never treats localhost or unverified deployment as a public demo', () => {
    const p = product({ demoUrl: '', project: {
      sourceType: 'zip', files: [], totalSize: 1, uploadId: 'upload-1', localStatus: 'pending',
      deployment: {
        projectId: '1', deploymentId: '1', status: 'ready', stage: 9,
        detectedFramework: 'React + Vite', detectedLanguage: 'TypeScript',
        buildCommand: 'npm run build', outputDirectory: 'dist',
        previewUrl: 'http://127.0.0.1:8787/', verified: true,
        errorMessage: null, createdAt: '', updatedAt: '',
      },
    } });
    expect(resolvePublicDemo(p)).toBeNull();
    expect(publishReadiness(p).length).toBeGreaterThan(0);
  });
  it('blocks catalog slugs that collide with site routes', () => {
    for (const slug of ['login', 'products', 'admin', 'demo', 'account', 'cart']) {
      expect(publishReadiness(product({ slug }))).toContain('Slug ini digunakan halaman LABDITS. Pilih slug lain.');
    }
    expect(publishReadiness(product({ slug: 'dashboardkeren' }))).toEqual([]);
  });
  it('does not replace a missing uploaded demo with a fake mock workspace', () => {
    expect(shouldShowBundledDemo(product({ demoUrl: '' }))).toBe(false);
    expect(shouldShowBundledDemo(seedProducts[0]!)).toBe(true);
  });
  it('uses a verified HTTPS build when external mode is absent', () => {
    const p = product({ demoMode: 'mock', demoUrl: '', project: {
      sourceType: 'zip', files: [], totalSize: 1, uploadId: 'upload-1', localStatus: 'ready',
      deployment: {
        projectId: '1', deploymentId: '1', status: 'ready', stage: 9,
        detectedFramework: 'React + Vite', detectedLanguage: 'TypeScript',
        buildCommand: 'npm run build', outputDirectory: 'dist',
        previewUrl: 'https://preview.example.com/', verified: true,
        errorMessage: null, createdAt: '', updatedAt: '',
      },
    } });
    expect(resolvePublicDemo(p)).toBe('https://preview.example.com/');
    expect(publishReadiness(p)).toEqual([]);
  });
});
