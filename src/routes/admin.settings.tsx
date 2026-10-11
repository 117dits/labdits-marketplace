import { createFileRoute } from '@tanstack/react-router';
import { AdminSettings } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/settings')({head:()=>pageHead('Store settings','Configure your LABDITS demo store profile, social links and preferences.'),component:AdminSettings});
