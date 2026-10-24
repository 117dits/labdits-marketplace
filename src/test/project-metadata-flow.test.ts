import { describe, expect, it } from 'vitest';
import { extractProjectMetadata } from '@/lib/project-meta-extractor';
import { applyExtractedMetadata, canAdvanceFromProject, initialProjectDraft } from '@/lib/product-wizard-flow';

const file = (path: string, content: string, mime = 'text/plain') => {
  const result = new File([content], path.split('/').at(-1)!, { type: mime });
  Object.defineProperty(result, 'webkitRelativePath', { value: path });
  Object.defineProperty(result, 'text', { value: async () => content });
  return result;
};

describe('metadata-first product flow', () => {
  it('starts with empty product fields, with no demo product name or image', () => {
    const draft = initialProjectDraft();
    expect([draft.name, draft.slug, draft.description, draft.image]).toEqual(['', '', '', '']);
    expect(canAdvanceFromProject(draft)).toBe(false);
  });
  it('extracts real application title/description ahead of generic package fields', async () => {
    const files = [
      file('my-app/package.json', JSON.stringify({ name: 'template', description: 'Starter template', dependencies: { react: '^19.0.0' } })),
      file('my-app/index.html', '<html><head><title>Kasir DitsStore</title><meta content="Sistem kasir untuk pengelolaan stok toko" name="description"></head></html>', 'text/html'),
    ];
    const meta = await extractProjectMetadata(files);
    expect(meta.title).toBe('Kasir DitsStore');
    expect(meta.description).toBe('Sistem kasir untuk pengelolaan stok toko');
    expect(meta.suggestedTags).toContain('React');
    const draft = applyExtractedMetadata(initialProjectDraft(), meta);
    expect(draft.slug).toBe('kasir-ditsstore');
    expect(draft.stack).toContain('React');
    expect(canAdvanceFromProject(draft)).toBe(true);
  });
  it('derives category and visible features from semantic HTML, not package marketing text', async () => {
    const html = file('kasir/index.html', '<html><head><title>Kasir Toko</title><meta name="description" content="Aplikasi kasir untuk pencatatan transaksi"></head><body><main><h1>Kasir Toko</h1><h2>Manajemen Stok</h2><h2>Laporan Penjualan</h2><button>Tambah Produk</button></main></body></html>', 'text/html');
    const meta = await extractProjectMetadata([html]);
    expect(meta.category).toBe('Sistem POS & Kasir');
    expect(meta.features).toEqual(expect.arrayContaining(['Manajemen Stok', 'Laporan Penjualan']));
    expect(meta.features).not.toContain('Tambah Produk');
  });
  it('extracts metadata from ZIP entries without requiring a prefilled product name', async () => {
    const zip = file('archive.zip', 'binary', 'application/zip');
    const meta = await extractProjectMetadata([zip], [
      { path: 'my-app/package.json', size: 100, read: async () => JSON.stringify({ name: 'vite-template', dependencies: { vue: '^3.0.0' } }) },
      { path: 'my-app/index.html', size: 200, read: async () => '<head><meta name="description" content="Manajemen inventaris multi gudang"><title>Gudang Pintar</title></head>' },
    ]);
    expect(meta.title).toBe('Gudang Pintar');
    expect(meta.description).toBe('Manajemen inventaris multi gudang');
    expect(meta.suggestedTags).toContain('Vue');
  });
  it('does not overwrite an existing edited listing when uploading a new version', () => {
    const old = { ...initialProjectDraft(), name: 'Judul Khusus', slug: 'judul-khusus', description: 'Penjelasan buatan admin', image: 'https://example.com/custom.png' };
    const next = applyExtractedMetadata(old, { title: 'Nama Baru', description: 'Isi Baru', thumbnailUrl: 'data:image/png;base64,AAAA', category: 'E-Commerce' });
    expect(next.name).toBe(old.name);
    expect(next.slug).toBe(old.slug);
    expect(next.description).toBe(old.description);
    expect(next.image).toBe(old.image);
    expect(next.category).toBe(old.category);
  });
  it('rejects a publishable listing if metadata cannot provide a meaningful title or description', () => {
    expect(canAdvanceFromProject(applyExtractedMetadata(initialProjectDraft(), { title: 'Aplikasi' }))).toBe(false);
  });
  it('allows advancing when slug has raw user formatting like spaces or uppercase', () => {
    const draft = {
      ...initialProjectDraft(),
      name: 'Kasir Toko Pintar',
      slug: 'Kasir Toko Pintar',
      description: 'Sistem POS untuk kasir toko',
    };
    expect(canAdvanceFromProject(draft)).toBe(true);
  });
  it('allows advancing when slug is blank but name is provided', () => {
    const draft = {
      ...initialProjectDraft(),
      name: 'Sistem Manajemen Inventaris',
      slug: '',
      description: 'Aplikasi pencatatan stok barang gudang',
    };
    expect(canAdvanceFromProject(draft)).toBe(true);
  });
});
