import { createFileRoute } from '@tanstack/react-router';
import { Login } from '@/components/views/account';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/login')({head:()=>pageHead('Demo sign-in','Explore LABDITS customer and owner accounts using simulated authentication.'),component:Login});
