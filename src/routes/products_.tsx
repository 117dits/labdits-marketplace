import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/views/marketplace';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/products')({validateSearch:(search:Record<string,unknown>)=>({category:typeof search.category==='string'?search.category:undefined,demos:search.demos===true||search.demos==='true'}),head:()=>pageHead('Your next great project','Discover premium ready-made websites, dashboards, SaaS and POS applications.'),component:ProductsRoute});
function ProductsRoute(){const {category,demos}=Route.useSearch();return <Marketplace initialCategory={category} demos={demos}/>;}
