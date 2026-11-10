import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { money } from '@/data/products';
import { listQrisgateOrders, type QrisgateHistoryOrder } from '@/services/qrisgate-history';

export function QrisgateHistory() {
  const [orders, setOrders] = useState<QrisgateHistoryOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void listQrisgateOrders().then((result) => {
      if (active) { setOrders(result); setError(''); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Gagal memuat pesanan.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  return <section className="panel mb-6" aria-label="Pesanan pembayaran otomatis">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2>Pesanan QRISGate</h2>
      <Button type="button" variant="outline" size="sm" onClick={() => setReload(n => n + 1)}>Perbarui</Button>
    </div>
    {loading && <p role="status">Memuat pesanan dari server…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && !error && !orders.length && <p className="text-sm text-muted-foreground">Belum ada pesanan otomatis.</p>}
    {!loading && !error && !!orders.length && <ul className="divide-y divide-border">
      {orders.map(order => <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-mono text-sm">{order.id}</p><p className="text-sm text-muted-foreground">{order.status} · {order.payment_method} · {money(order.total)}</p></div>
        <Button variant="outline" size="sm" asChild><Link to="/order/$id" params={{ id: order.id }}>Lihat status</Link></Button>
      </li>)}
    </ul>}
    <p className="mt-3 text-xs text-muted-foreground">Status lunas adalah konfirmasi pembayaran, bukan hak unduh. Akses produk diberikan hanya melalui layanan unduhan resmi setelah tersedia.</p>
  </section>;
}
