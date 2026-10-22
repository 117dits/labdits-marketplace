import { createFileRoute } from '@tanstack/react-router';
import { AdminCustomers } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/customers')({head:()=>pageHead('Kelola Pelanggan','Daftar pelanggan, riwayat transaksi, dan status akun pengguna.'),component:AdminCustomers});
