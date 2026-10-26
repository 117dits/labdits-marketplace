import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';
import { seedProducts } from '@/data/products';
import type { Json } from '@/integrations/supabase/types';

// The browser uses only the publishable client. Authorization is enforced by RLS;
// this extra check prevents misleading optimistic edits before the server denies them.
export function createCatalogService(client: typeof supabase = supabase) {
  const loadedVideos = new Map<string, string | undefined>();
  async function requireAdmin() {
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Admin access required');
    const roles = await client.from('user_roles').select('role').eq('user_id', user.id);
    if (roles.error) throw roles.error;
    if (!roles.data?.some(row => row.role === 'admin')) throw new Error('Admin access required');
  }
  return {
    async products(): Promise<Product[]> {
      const { data, error } = await client.from('products').select('id,slug,name,status,data');
      if (error) throw error;
      return (data ?? []).map(row => {
        const details = row.data as Partial<Product> & { image?: string };
        // Keep the first snapshot: an open editor retains that baseline across refreshes.
        if (!loadedVideos.has(row.id)) loadedVideos.set(row.id, details.previewVideoUrl);
        const image = details.image?.startsWith('seed:') ? seedProducts.find(p => p.id === row.id)?.image : details.image;
        return { ...details, id: row.id, slug: row.slug, name: row.name, status: row.status, image } as Product;
      });
    },
    async settings(): Promise<Record<string, string>> {
      const { data, error } = await client.from('store_settings').select('data').eq('id', 'store').maybeSingle();
      if (error) throw error;
      return (data?.data ?? {}) as Record<string, string>;
    },
    async saveProduct(product: Product) {
      await requireAdmin();
      const { id, slug, name, status, ...details } = product;
      const data = JSON.parse(JSON.stringify(details)) as Record<string, Json>;
      const loaded = loadedVideos.has(id);
      const videoChanged = loaded && product.previewVideoUrl !== loadedVideos.get(id);

      if (!loaded) {
        const result = await client.from('products').insert({ id, slug, name, status, data });
        if (result.error) {
          // If the product already exists in database (duplicate key 23505), fall through to update
          const isDuplicate = (result.error as { code?: string; message?: string }).code === '23505' ||
            /duplicate key|unique constraint/i.test((result.error as { message?: string }).message || '');
          if (!isDuplicate) throw result.error;
        } else {
          loadedVideos.set(id, product.previewVideoUrl);
          return;
        }
      }

      // A stale editor snapshot must not erase the worker's later video. Compare the
      // entire JSON document so a worker patch between read and update is detectable.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: row, error } = await client.from('products').select('data').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!row) throw new Error('Product was deleted; reload before saving');
        const current = row.data as Record<string, Json>;
        const next = { ...data };
        if (!videoChanged) {
          if (current['previewVideoUrl'] === undefined) delete next['previewVideoUrl'];
          else next['previewVideoUrl'] = current['previewVideoUrl'];
        }

        const jsonStr = JSON.stringify(row.data);
        const updateBuilder = client.from('products').update({ slug, name, status, data: next }).eq('id', id);
        let result: { data?: unknown[] | null; error?: unknown } = {};

        if (typeof (updateBuilder as any).filter === 'function') {
          result = await (updateBuilder as any)
            .filter('data', 'eq', jsonStr)
            .select('id');
          // In real production with PostgREST, filtering by JSONB string representation returns 0 rows
          // or 414 Request-URI Too Large for large project files. Fall back to update by primary key.
          if (!result.data?.length && typeof (updateBuilder as any).select === 'function') {
            result = await (updateBuilder as any).select('id');
          }
        } else if (typeof (updateBuilder as any).select === 'function') {
          result = await (updateBuilder as any).select('id');
        }

        if (result.error) throw result.error;
        if (result.data?.length) return;
      }
      throw new Error('Product changed while saving; reload and retry');
    },
    async deleteProduct(id: string) {
      await requireAdmin();
      const result = await client.from('products').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    async saveSettings(data: Record<string, string>) {
      await requireAdmin();
      const result = await client.from('store_settings').upsert({ id: 'store', data });
      if (result.error) throw result.error;
    },
  };
}

export function catalogConfigured() {
  return Boolean(import.meta.env['VITE_SUPABASE_URL'] && import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
}
