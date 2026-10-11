import { createFileRoute } from '@tanstack/react-router';
import { AdminCustomers } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/customers')({head:()=>pageHead('Customer management','Explore customer profiles and sample purchase histories.'),component:AdminCustomers});
