import { createFileRoute } from '@tanstack/react-router';
import { ProductDetail } from '@/components/views/marketplace';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/products/$slug')({head:({params})=>pageHead(`Detail Produk: ${params.slug}`,'Lihat fitur lengkap, teknologi, dan opsi lisensi produk LABDITS.'),component:Page});
function Page(){const {slug}=Route.useParams();return <ProductDetail slug={slug}/>;}
