import { createFileRoute } from '@tanstack/react-router';
import { AdminSettings } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/settings')({head:()=>pageHead('Pengaturan Sistem','Konfigurasi profil toko, tautan media sosial, dan integrasi pembayaran LABDITS.'),component:AdminSettings});
