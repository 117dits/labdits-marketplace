import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/categories')({head:()=>pageHead('Kategori Produk','Jelajahi beragam kategori produk digital mulai dari dashboard admin hingga sistem POS.'),component:()=> <ContentPage page='categories'/>});
