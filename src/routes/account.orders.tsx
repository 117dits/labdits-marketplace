import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/account/orders')({head:()=>pageHead('Riwayat Pesanan','Lihat status pembayaran dan nota pesanan aplikasi Anda.'),component:()=> <AccountPage view='orders'/>});
