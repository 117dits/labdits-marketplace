import { createFileRoute } from '@tanstack/react-router';
import { AdminProducts } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/products_')({head:()=>pageHead('Manage products','Create, edit, publish and curate products in the LABDITS frontend owner workspace.'),component:AdminProducts});
