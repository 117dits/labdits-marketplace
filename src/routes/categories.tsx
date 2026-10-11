import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/categories')({head:()=>pageHead('Product categories','Explore product categories at LABDITS, a premium independent digital product studio.'),component:()=> <ContentPage page='categories'/>});
