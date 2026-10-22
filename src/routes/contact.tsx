import { createFileRoute } from '@tanstack/react-router';
import { ContentPage } from '@/components/views/content';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/contact')({head:()=>pageHead('Hubungi Pengembang','Konsultasikan kebutuhan proyek aplikasi kustom atau pertanyaan lisensi Anda.'),component:()=> <ContentPage page='contact'/>});
