import { createFileRoute } from '@tanstack/react-router';
import { ProductWizard } from '@/components/admin/product-wizard';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/products/new')({head:()=>pageHead('Create a product','Prepare your next LABDITS product with a five-step frontend publishing workflow.'),component:()=> <ProductWizard/>});
