import { createFileRoute } from '@tanstack/react-router';
import { CheckoutSuccess } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/checkout/success')({head:()=>pageHead('Demo order confirmation','Review your simulated LABDITS order and explore sample downloads.'),component:CheckoutSuccess});
