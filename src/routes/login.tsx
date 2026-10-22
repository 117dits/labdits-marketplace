import { createFileRoute } from '@tanstack/react-router';
import { Login } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/login')({head:()=>pageHead('Masuk Akun','Akses portal akun pelanggan dan admin LABDITS.'),component:Login});
