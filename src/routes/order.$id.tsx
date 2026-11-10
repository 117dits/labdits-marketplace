import { createFileRoute } from '@tanstack/react-router';
import { QrisgateOrderPage } from '@/components/views/qrisgate-order';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute('/order/$id')({
  head: () => pageHead('Status Pesanan', 'Pantau status pembayaran QRISGate.'),
  component: () => <QrisgateOrderPage orderId={Route.useParams().id} />,
});
