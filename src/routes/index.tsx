import { createFileRoute } from '@tanstack/react-router';
import { Home } from '@/components/views/home';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/')({head:()=>pageHead('Digital Experiences. Built Beyond Ordinary.','Premium websites, dashboards, and digital experiences. Explore interactive demos before making them yours.'),component:Home});
