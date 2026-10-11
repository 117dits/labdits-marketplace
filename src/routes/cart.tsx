import { createFileRoute } from '@tanstack/react-router';
import { Cart } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/cart')({head:()=>pageHead('Shopping cart','Choose your digital products and licenses in the LABDITS shopping cart.'),component:Cart});
