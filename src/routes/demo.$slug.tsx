import { createFileRoute } from '@tanstack/react-router';
import { DemoViewer } from '@/components/demo/demo-viewer';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/demo/$slug')({head:({params})=>pageHead(`Interactive demo: ${params.slug}`,'Explore this LABDITS digital product and its thoughtfully crafted experience.'),component:Page});
function Page(){const {slug}=Route.useParams();return <DemoViewer slug={slug}/>;}
