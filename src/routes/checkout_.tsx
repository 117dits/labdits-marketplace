import { createFileRoute } from '@tanstack/react-router';
import { Checkout } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/checkout_')({head:()=>pageHead('Demo checkout','Explore a clearly labeled, frontend-only checkout. No real payment is processed.'),component:Checkout});
