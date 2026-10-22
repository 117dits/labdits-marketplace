import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/account_')({head:()=>pageHead('Area Pelanggan','Kelola pesanan, lisensi, dan unduh source code aplikasi Anda.'),component:()=> <AccountPage view='overview'/>});
