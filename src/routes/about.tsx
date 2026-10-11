import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/about')({head:()=>pageHead('About the studio','Explore about the studio at LABDITS, a premium independent digital product studio.'),component:()=> <ContentPage page='about'/>});
