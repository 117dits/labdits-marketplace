import { describe, expect, it } from 'vitest';
import { generateAIPreviewVideo, isAIVideoGenerationSupported } from '@/lib/ai-preview-video';

describe('AI preview video generator', () => {
  it('detects video generation capability or safe fallback', () => {
    expect(typeof isAIVideoGenerationSupported()).toBe('boolean');
  });

  it('generates a valid video blob from product metadata', async () => {
    const blob = await generateAIPreviewVideo({
      title: 'FinanceFlow Pro',
      subtitle: 'Dashboard Manajemen Keuangan & Pembukuan',
      category: 'Dashboard Admin',
      features: ['Real-time monitoring', 'Export laporan pajak', 'Integrasi bank'],
      theme: 'mint',
      durationSec: 1,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/^video\/(webm|mp4)/);
  });

  it('requires a valid title and rejects empty parameters', async () => {
    await expect(generateAIPreviewVideo({ title: '' })).rejects.toThrow(/title/i);
  });
});
