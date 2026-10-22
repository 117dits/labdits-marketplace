import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/account/settings')({head:()=>pageHead('Pengaturan Akun','Kelola profil, email, dan preferensi akun LABDITS Anda.'),component:()=> <AccountPage view='settings'/>});
