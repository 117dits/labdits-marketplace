import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/licenses')({head:()=>pageHead('Ketentuan Lisensi','Informasi transparan mengenai hak cipta, lisensi personal, dan lisensi komersial.'),component:()=> <ContentPage page='licenses'/>});
