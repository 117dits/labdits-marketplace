import { createFileRoute } from '@tanstack/react-router';
import { Home } from '@/components/views/home';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/')({head:()=>pageHead('Pengalaman Digital. Dibuat Melampaui Batas Biasa.','Website premium, dashboard admin, dan aplikasi digital siap pakai. Coba live demo interaktif sebelum membeli.'),component:Home});
