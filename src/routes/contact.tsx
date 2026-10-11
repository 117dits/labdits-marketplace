import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/contact')({head:()=>pageHead('Contact the developer','Explore contact the developer at LABDITS, a premium independent digital product studio.'),component:()=> <ContentPage page='contact'/>});
