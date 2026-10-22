import { createFileRoute } from '@tanstack/react-router';
import { AdminAnalytics } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/analytics')({head:()=>pageHead('Analitik Toko','Pantau performa penjualan, omzet harian, interaksi pengunjung, dan konversi etalase.'),component:AdminAnalytics});
