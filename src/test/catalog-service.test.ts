import { describe, expect, it, vi } from 'vitest';
import { createCatalogService } from '@/services/catalog-service';
import type { Product } from '@/types';

const product = { id: 'p', slug: 'test', name: 'Test', status: 'draft', price: 10 } as Product;
function backend({ admin = true, error = null as null | { message: string } } = {}) {
  const calls: unknown[][] = [];
  const query = { select: vi.fn(async () => ({ data: [{ id: 'p', slug: 'test', name: 'Test', status: 'draft', data: { price: 10, image: '' } }], error })), upsert: vi.fn(async (...args: unknown[]) => { calls.push(args); return { error }; }), delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error })) })), eq: vi.fn(async () => ({ data: admin ? [{ role: 'admin' }] : [], error })) };
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
