import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/how-it-works')({head:()=>pageHead('How it works','Explore how it works at LABDITS, a premium independent digital product studio.'),component:()=> <ContentPage page='how-it-works'/>});
