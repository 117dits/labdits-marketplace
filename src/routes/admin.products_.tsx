import { createFileRoute } from '@tanstack/react-router';
import { AdminProducts } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/products_')({head:()=>pageHead('Kelola Produk','Tambah, edit, publikasikan, dan atur etalase produk digital LABDITS.'),component:AdminProducts});
