import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/support')({head:()=>pageHead('Bantuan & FAQ','Panduan instalasi produk, tanya jawab umum, dan saluran dukungan pengembang.'),component:()=> <ContentPage page='support'/>});
