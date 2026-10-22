import { createFileRoute } from '@tanstack/react-router';
import { Checkout } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/checkout_')({head:()=>pageHead('Pembayaran & Checkout','Selesaikan pembayaran pesanan lisensi Anda dengan aman melalui gateway Pakasir.'),component:Checkout});
