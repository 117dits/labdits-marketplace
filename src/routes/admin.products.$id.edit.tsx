import { createFileRoute } from '@tanstack/react-router';
import { ProductWizard } from '@/components/admin/product-wizard';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/products/$id/edit')({head:({params})=>pageHead(`Edit Produk: ${params.id}`,'Perbarui detail produk, harga, lisensi, dan aset media.'),component:Page});
function Page(){const {id}=Route.useParams();return <ProductWizard id={id}/>;}
