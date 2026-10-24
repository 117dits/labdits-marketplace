import type { Product } from '@/types';
import type { ExtractedProjectMeta } from '@/lib/project-meta-extractor';
type SuggestedMetadata = { [K in keyof ExtractedProjectMeta]?: ExtractedProjectMeta[K] | undefined };
import { categories } from '@/data/products';

export function projectSlug(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function initialProjectDraft(): Product {
  return {
    id: '', slug: '', name: '', subtitle: '', description: '',
    category: categories[0] || 'Aplikasi Kustom',
    features: [], stack: [], price: 0, commercialPrice: 0, installationPrice: 0,
    image: '', theme: 'mint', featured: false, status: 'draft', popularity: 0,
    version: '1.0.0', updated: '', files: [],
  };
}

export function applyExtractedMetadata(draft: Product, meta: SuggestedMetadata): Product {
  return {
    ...draft,
    name: draft.name || meta.title || '',
    slug: draft.slug || projectSlug(meta.title || ''),
    description: draft.description || meta.description || '',
    subtitle: draft.subtitle || (meta.description || '').slice(0, 120),
    image: draft.image || meta.thumbnailUrl || '',
    stack: draft.stack.length ? draft.stack : (meta.suggestedTags || []),
    category: draft.name ? draft.category : (meta.category || draft.category),
    features: draft.features.length ? draft.features : (meta.features || []),
  };
}

export function canAdvanceFromProject(draft: Pick<Product, 'name' | 'slug' | 'description'>): boolean {
  return Boolean(draft.name.trim() && draft.slug.trim() && draft.description.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug));
}
