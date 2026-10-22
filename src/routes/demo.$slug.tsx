import { createFileRoute } from '@tanstack/react-router';
import { DemoViewer } from '@/components/demo/demo-viewer';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/demo/$slug')({head:({params})=>pageHead(`Live Demo: ${params.slug}`,'Uji coba langsung live preview aplikasi interaktif LABDITS.'),component:Page});
function Page(){const {slug}=Route.useParams();return <DemoViewer slug={slug}/>;}
