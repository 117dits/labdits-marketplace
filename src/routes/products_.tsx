import { z } from 'zod';
import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/views/marketplace';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/products_')({validateSearch:z.object({category:z.string().optional(),demos:z.boolean().optional()}),head:()=>pageHead('Koleksi Produk Digital','Temukan template website premium, dashboard admin, SaaS, dan aplikasi POS siap pakai.'),component:ProductsRoute});
function ProductsRoute(){const {category,demos}=Route.useSearch();return <Marketplace initialCategory={category||''} demos={demos||false}/>;}
