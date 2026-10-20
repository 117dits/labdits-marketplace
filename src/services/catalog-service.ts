import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';
import { seedProducts } from '@/data/products';
import type { Json } from '@/integrations/supabase/types';

// The browser uses only the publishable client. Authorization is enforced by RLS;
// this extra check prevents misleading optimistic edits before the server denies them.
export function createCatalogService(client: typeof supabase = supabase) {
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
      const { id, slug, name, status, ...data } = product;
      const result = await client.from('products').upsert({ id, slug, name, status, data: JSON.parse(JSON.stringify(data)) as Json });
      if (result.error) throw result.error;
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
