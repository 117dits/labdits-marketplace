import { createFileRoute } from '@tanstack/react-router';
import { CheckoutSuccess } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/checkout/success')({head:()=>pageHead('Konfirmasi Pesanan','Pesanan Anda berhasil dikonfirmasi. Akses source code dan unduhan Anda.'),component:CheckoutSuccess});
