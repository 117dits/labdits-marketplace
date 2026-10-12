import { z } from 'zod';
import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/views/marketplace';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/products_')({validateSearch:z.object({category:z.string().optional(),demos:z.boolean().optional()}),head:()=>pageHead('Your next great project','Discover premium ready-made websites, dashboards, SaaS and POS applications.'),component:ProductsRoute});
function ProductsRoute(){const {category,demos}=Route.useSearch();return <Marketplace initialCategory={category||''} demos={demos||false}/>;}
