import { createFileRoute } from '@tanstack/react-router';
import { AdminOverview } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin_')({head:()=>pageHead('Dashboard Admin','Kelola katalog produk, pantau penjualan, dan status deployment sistem LABDITS.'),component:AdminOverview});
