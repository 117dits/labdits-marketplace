import { createFileRoute } from '@tanstack/react-router';
import { AdminOverview } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin_')({head:()=>pageHead('Owner overview','Manage your LABDITS demo marketplace and view revenue and product performance.'),component:AdminOverview});
