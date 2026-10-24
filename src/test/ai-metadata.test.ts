import { describe, expect, it } from 'vitest';
import { generateAIMetadata, isAIMetadataSupported } from '@/lib/ai-metadata';

describe('AI project metadata generator', () => {
  it('supports AI metadata generation without requiring external services', () => {
    expect(isAIMetadataSupported()).toBe(true);
  });

  it('generates rich commercial Indonesian metadata from raw POS code signals', async () => {
    const result = await generateAIMetadata({
      rawTitle: 'pos-app',
      rawDescription: 'simple pos system',
      files: ['package.json', 'src/Kasir.tsx', 'src/Stok.tsx', 'src/Laporan.tsx'],
      packageJson: {
        name: 'pos-app',
        dependencies: { react: '^18.0.0', tailwindcss: '^3.0.0', lucide_react: '^1.0.0' },
      },
      headings: ['Kasir Toko Retail', 'Manajemen Stok Multi-Gudang', 'Laporan Penjualan Harian'],
    });

    expect(result.title).toMatch(/Kasir|POS/i);
    expect(result.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(result.subtitle.length).toBeGreaterThan(15);
    expect(result.description.length).toBeGreaterThan(60);
    expect(result.category).toBe('Sistem POS & Kasir');
    expect(result.features.length).toBeGreaterThanOrEqual(3);
    expect(result.features.some((f) => /kasir|transaksi|stok|penjualan/i.test(f))).toBe(true);
    expect(result.stack).toContain('React');
    expect(result.stack).toContain('Tailwind CSS');
    expect(result.suggestedPrices?.price).toBeGreaterThan(0);
    expect(result.aiGenerated).toBe(true);
  });

  it('generates engaging SaaS metadata when discovering workspace or subscription keywords', async () => {
    const result = await generateAIMetadata({
      rawTitle: 'saas-starter',
      files: ['src/billing.ts', 'src/team.tsx', 'src/analytics.tsx'],
      headings: ['Workspace Kolaborasi Tim', 'Langganan & Billing Otomatis'],
    });

    expect(result.category).toBe('Aplikasi SaaS');
    expect(result.title.length).toBeGreaterThan(5);
    expect(result.features.some((f) => /tim|langganan|kolaborasi|manajemen/i.test(f))).toBe(true);
  });

  it('handles sparse inputs gracefully with fallback AI generation', async () => {
    const result = await generateAIMetadata({
      rawTitle: '',
      files: ['index.html'],
    });

    expect(result.title.length).toBeGreaterThan(3);
    expect(result.slug.length).toBeGreaterThan(3);
    expect(result.description.length).toBeGreaterThan(20);
    expect(result.features.length).toBeGreaterThanOrEqual(3);
    expect(result.aiGenerated).toBe(true);
  });
});
