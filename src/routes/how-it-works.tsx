import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/how-it-works')({head:()=>pageHead('Cara Kerja','Pelajari alur praktis dari eksplorasi produk, uji live demo, hingga peluncuran.'),component:()=> <ContentPage page='how-it-works'/>});
