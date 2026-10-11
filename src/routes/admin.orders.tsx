import { createFileRoute } from '@tanstack/react-router';
import { AdminOrders } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/orders')({head:()=>pageHead('Manage orders','Review simulated LABDITS purchases, customers and payment statuses.'),component:AdminOrders});
