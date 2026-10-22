import { createFileRoute } from '@tanstack/react-router';
import { Cart } from '@/components/views/commerce';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/cart')({head:()=>pageHead('Keranjang Belanja','Pilih lisensi produk digital dan lanjutkan ke proses checkout pembayaran.'),component:Cart});
