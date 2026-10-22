import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/about')({head:()=>pageHead('Tentang LABDITS','Studio produk digital mandiri yang menghadirkan website dan dashboard berkualitas tinggi.'),component:()=> <ContentPage page='about'/>});
