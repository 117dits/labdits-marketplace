import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/account/downloads')({head:()=>pageHead('Unduhan Source Code','Akses dan unduh berkas source code untuk setiap lisensi yang telah Anda beli.'),component:()=> <AccountPage view='downloads'/>});
