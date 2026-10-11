import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/support')({head:()=>pageHead('Help and support','Explore help and support at LABDITS, a premium independent digital product studio.'),component:()=> <ContentPage page='support'/>});
