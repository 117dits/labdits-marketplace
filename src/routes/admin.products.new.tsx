import { createFileRoute } from '@tanstack/react-router';
import { ProductWizard } from '@/components/admin/product-wizard';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/products/new')({head:()=>pageHead('Tambah Produk Baru','Unggah source code dan publikasikan produk digital baru ke etalase.'),component:()=> <ProductWizard/>});
