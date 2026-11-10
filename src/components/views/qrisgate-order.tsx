import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getQrisgateOrder, type QrisgateOrder } from '@/services/qrisgate-service';
import { supabase } from '@/integrations/supabase/client';
import { money } from '@/data/products';
import { Button } from '@/components/ui/button';

export function QrisgateOrderPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<QrisgateOrder | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pollingStopped, setPollingStopped] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const refresh = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Silakan masuk kembali untuk melihat status pesanan.');
        const result = await getQrisgateOrder(orderId, session.access_token);
        if (!active) return;
        setOrder(result);
        setError('');
        const deadline = result.expires_at ? new Date(result.expires_at).getTime() : started + 15 * 60_000;
        const continuePolling = result.status === 'Pending' && Date.now() < deadline && Date.now() - started < 15 * 60_000;
        setPollingStopped(result.status === 'Pending' && !continuePolling);
        if (continuePolling) timer = setTimeout(refresh, 3000);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Tidak dapat memuat pesanan.');
          setPollingStopped(true);
        }
      }
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, retry]);
  const paid = order?.status === 'Paid';
  return <div className="site-container py-16"><div className="panel mx-auto max-w-xl space-y-5">
    <p className="eyebrow">LABDITS / STATUS PESANAN</p>
    <h1 className="text-2xl font-bold">Pesanan {orderId}</h1>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pollingStopped && <div className="space-y-2"><p className="text-sm text-muted-foreground">Pemeriksaan otomatis berhenti. Status pembayaran mungkin berubah setelah halaman diperbarui.</p><Button variant="outline" onClick={() => { setError(''); setPollingStopped(false); setRetry((value) => value + 1); }}>Periksa status sekarang</Button></div>}
    {!order && !error && <p role="status">Memuat status pembayaran…</p>}
    {order && <>
      <p role="status" className="text-lg font-semibold">{paid ? 'Pembayaran lunas' : order.status === 'Pending' ? 'Menunggu pembayaran' : `Status: ${order.status}`}</p>
      <p>Total tepat termasuk kode unik: <strong>{money(order.total_amount)}</strong></p>
      {order.status === 'Pending' && <><p className="text-sm text-muted-foreground">Status dicek ke server setiap 3 detik hingga kedaluwarsa (maksimal 15 menit). Jangan membulatkan nominal pembayaran.</p><Button asChild><a href={order.checkout_url} rel="noreferrer">Buka instruksi pembayaran QRISGate</a></Button></>}
      {paid && <p className="text-sm text-muted-foreground">Pembayaran telah diverifikasi server. Akses produk hanya tersedia bila entitlement telah diterbitkan.</p>}
    </>}
    <Button variant="outline" asChild><Link to="/account/orders">Kembali ke pesanan saya</Link></Button>
  </div></div>;
}
