import { createFileRoute } from '@tanstack/react-router';
import { AdminOrders } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/orders')({head:()=>pageHead('Kelola Pesanan','Daftar transaksi pelanggan, nomor invoice, dan status pembayaran pesanan.'),component:AdminOrders});
