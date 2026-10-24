import { describe, expect, it, vi } from 'vitest';
import { createCatalogService } from '@/services/catalog-service';
import type { Product } from '@/types';

const product = { id: 'p', slug: 'test', name: 'Test', status: 'draft', price: 10 } as Product;
function backend({ admin = true, error = null as null | { message: string } } = {}) {
  const calls: unknown[][] = [];
  const query = {
    select: vi.fn(async (): Promise<{ data: unknown[]; error: typeof error }> => ({ data: [{ id: 'p', slug: 'test', name: 'Test', status: 'draft', data: { price: 10, image: '' } }], error })),
    upsert: vi.fn(async (...args: unknown[]) => { calls.push(args); return { error }; }),
    insert: vi.fn(async (...args: unknown[]) => { calls.push(args); return { error }; }),
    update: vi.fn((...args: unknown[]) => { calls.push(args); return { eq: () => ({ filter: (..._args: unknown[]) => ({ select: async () => ({ data: [{ id: 'p' }], error }) }) }) }; }),
    delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error })) })),
    eq: vi.fn(async () => ({ data: admin ? [{ role: 'admin' }] : [], error })),
  };
  const client = { from: vi.fn((table: string) => table === 'user_roles' ? { select: () => query } : query), auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })) } };
  return { client, calls, query };
}
describe('catalog service', () => {
  it('maps rows into products without trusting browser storage', async () => {
    const { client } = backend();
    const service = createCatalogService(client as never);
    expect(await service.products()).toMatchObject([{ id: 'p', slug: 'test', name: 'Test', status: 'draft', price: 10 }]);
  });
  it('resolves seeded image references to bundled preview assets', async () => {
    const { client, query } = backend();
    query.select.mockResolvedValueOnce({ data: [{ id: '1', slug: 'financeflow', name: 'FinanceFlow', status: 'published', data: { price: 10, image: 'seed:1' } }], error: null });
    const [item] = await createCatalogService(client as never).products();
    expect(item?.image).toMatch(/financeflow/);
  });
  it('rejects non-admin writes before issuing mutations', async () => {
    const { client, query } = backend({ admin: false });
    await expect(createCatalogService(client as never).saveProduct(product)).rejects.toThrow('Admin access required');
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('round-trips an uploaded video URL in the product JSON data', async () => {
    const { client, calls, query } = backend();
    const video = 'https://cdn.example/real.webm';
    await createCatalogService(client as never).saveProduct({ ...product, previewVideoUrl: video });
    expect((calls[0]?.[0] as { data: Product }).data.previewVideoUrl).toBe(video);
    query.select.mockResolvedValueOnce({ data: [{ id: 'p', slug: 'test', name: 'Test', status: 'published', data: { image: '', previewVideoUrl: video } }], error: null });
    expect((await createCatalogService(client as never).products())[0]?.previewVideoUrl).toBe(video);
  });
  it('preserves a worker video added after the editor loaded while saving admin edits', async () => {
    const { client, query } = backend();
    let row = { id: 'p', slug: 'test', name: 'Test', status: 'draft', data: { price: 10, previewVideoUrl: undefined as string | undefined } };
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: { data: { ...row.data } }, error: null }) }) }
      : Promise.resolve({ data: [{ ...row, data: { ...row.data } }], error: null })) as never);
    query.update.mockImplementation((...args: unknown[]) => ({ eq: () => ({ filter: (..._args: unknown[]) => ({ select: async () => {
      row = { ...row, ...args[0] as typeof row };
      return { data: [{ id: row.id }], error: null };
    } }) }) }));
    const service = createCatalogService(client as never);
    await service.products(); // editor's original snapshot has no video
    row.data.previewVideoUrl = 'https://cdn.example/worker.mp4';
    await service.saveProduct({ ...product, price: 12 });
    expect(row.data).toMatchObject({ price: 12, previewVideoUrl: 'https://cdn.example/worker.mp4' });
    await service.saveProduct({ ...product, price: 13 }); // provider still holds the original draft
    expect(row.data).toMatchObject({ price: 13, previewVideoUrl: 'https://cdn.example/worker.mp4' });
  });
  it('keeps worker video even if catalog refreshes while the editor holds its old draft', async () => {
    const { client, query } = backend();
    let video: string | undefined;
    let saved: unknown;
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: { data: { price: 10, previewVideoUrl: video } }, error: null }) }) }
      : Promise.resolve({ data: [{ id: 'p', slug: 'test', name: 'Test', status: 'draft', data: { price: 10, previewVideoUrl: video } }], error: null })) as never);
    query.update.mockImplementation((...args: unknown[]) => { saved = args[0]; return { eq: () => ({ filter: () => ({ select: async () => ({ data: [{ id: 'p' }], error: null }) }) }) }; });
    const service = createCatalogService(client as never);
    const [stale] = await service.products();
    video = 'https://cdn.example/worker.mp4';
    await service.products(); // an auth-driven refresh must not rewrite the editor's baseline
    await service.saveProduct({ ...stale!, price: 12 });
    expect(saved).toMatchObject({ data: { price: 12, previewVideoUrl: video } });
  });
  it('keeps an explicitly changed video URL even when worker published a different one', async () => {
    const { client, query } = backend();
    let saved: unknown;
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: { data: { price: 10, previewVideoUrl: 'https://cdn.example/worker.mp4' } }, error: null }) }) }
      : Promise.resolve({ data: [{ id: 'p', data: { price: 10 } }], error: null })) as never);
    query.update.mockImplementation((...args: unknown[]) => { saved = args[0]; return { eq: () => ({ filter: () => ({ select: async () => ({ data: [{ id: 'p' }], error: null }) }) }) }; });
    const service = createCatalogService(client as never);
    await service.products();
    await service.saveProduct({ ...product, previewVideoUrl: 'https://cdn.example/admin.mp4' });
    expect(saved).toMatchObject({ data: { previewVideoUrl: 'https://cdn.example/admin.mp4' } });
  });
  it('does not resurrect a product removed before save', async () => {
    const { client, query } = backend();
    const service = createCatalogService(client as never);
    await service.products();
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
      : Promise.resolve({ data: [], error: null })) as never);
    await expect(service.saveProduct(product)).rejects.toThrow('Product was deleted');
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.upsert).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
    expect(query.delete).not.toHaveBeenCalled();
  });
  it('retries if worker publishes between the save read and conditional update', async () => {
    const { client, query } = backend();
    let video: string | undefined;
    let saved: unknown;
    let updates = 0;
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: { data: { price: 10, ...(video ? { previewVideoUrl: video } : {}) } }, error: null }) }) }
      : Promise.resolve({ data: [{ id: 'p', data: { price: 10 } }], error: null })) as never);
    query.update.mockImplementation((...args: unknown[]) => ({ eq: () => ({ filter: (...filterArgs: unknown[]) => ({ select: async () => {
      updates++;
      if (updates === 1) video = 'https://cdn.example/worker.mp4';
      if (filterArgs[2] !== JSON.stringify({ price: 10, ...(video ? { previewVideoUrl: video } : {}) })) return { data: [], error: null };
      saved = args[0];
      return { data: [{ id: 'p' }], error: null };
    } }) }) }));
    const service = createCatalogService(client as never);
    await service.products();
    await service.saveProduct({ ...product, price: 12 });
    expect(updates).toBe(2);
    expect(saved).toMatchObject({ data: { price: 12, previewVideoUrl: video } });
  });
  it('reports a persistent compare-and-set conflict without overwriting a newer product', async () => {
    const { client, query } = backend();
    const service = createCatalogService(client as never);
    await service.products();
    query.select.mockImplementation(((fields: string) => fields === 'data'
      ? { eq: () => ({ maybeSingle: async () => ({ data: { data: { price: 10 } }, error: null }) }) }
      : Promise.resolve({ data: [], error: null })) as never);
    query.update.mockImplementation(() => ({ eq: () => ({ filter: () => ({ select: async () => ({ data: [], error: null }) }) }) }));
    await expect(service.saveProduct({ ...product, price: 12 })).rejects.toThrow('Product changed while saving');
    expect(query.update).toHaveBeenCalledTimes(3);
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('persists catalog columns and product data only for an admin', async () => {
    const { client, calls } = backend();
    await createCatalogService(client as never).saveProduct(product);
    expect(calls[0]?.[0]).toEqual({ id: 'p', slug: 'test', name: 'Test', status: 'draft', data: { price: 10 } });
  });
  it('propagates read errors instead of showing a stale mock catalog', async () => {
    const { client } = backend({ error: { message: 'network unavailable' } });
    await expect(createCatalogService(client as never).products()).rejects.toThrow('network unavailable');
  });
});
