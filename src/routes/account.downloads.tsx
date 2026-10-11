import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/account/downloads')({head:()=>pageHead('Customer downloads','Manage your LABDITS demo account, purchased products, orders and sample downloads.'),component:()=> <AccountPage view='downloads'/>});
