import { createFileRoute } from '@tanstack/react-router';
import { ProductDetail } from '@/components/views/marketplace';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/products/$slug')({head:({params})=>pageHead(`Product details: ${params.slug}`,'Explore this LABDITS digital product and its thoughtfully crafted experience.'),component:Page});
function Page(){const {slug}=Route.useParams();return <ProductDetail slug={slug}/>;}
