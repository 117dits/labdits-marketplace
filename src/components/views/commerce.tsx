import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, ShoppingBag, Trash2, ShieldCheck, Info, CheckCircle2, Download, CreditCard, QrCode, Landmark, Wallet, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/views/marketplace';
import { useMarketplace } from '@/hooks/use-marketplace';
import { money, licenseNames, priceFor } from '@/data/products';
import { createPakasirTransaction, type PakasirCreateResponse } from '@/services/pakasir-service';
import { QrCodeDisplay } from '@/components/ui/qr-code';
import type { License } from '@/types';
export function OrderSummary({checkout=false}:{checkout?:boolean}){
  const store = useMarketplace();
  return (
    <aside className="panel">
      <h2>Ringkasan Pesanan</h2>
      {store.cart.map((i, n) => {
        const p = store.products.find(p => p.id === i.productId);
        return p ? (
          <div className="summary-row" key={n}>
            <div>
              {p.name}
              <span className="mt-1 block text-[10px] text-muted-foreground">
                {licenseNames[i.license]} · {i.quantity} lisensi
              </span>
            </div>
            <span className="shrink-0 font-medium">{money(priceFor(p, i.license) * i.quantity)}</span>
          </div>
        ) : null;
      })}
      <div className="summary-row">
        <span>Subtotal</span>
        <span>{money(store.total)}</span>
      </div>
      <div className="summary-row">
        <span>Pengiriman</span>
        <span className="text-success font-medium">Akses Digital Instan</span>
      </div>
      <div className="summary-row summary-total">
        <span>Total Pembayaran</span>
        <strong className="text-primary">{money(store.total)}</strong>
      </div>
      {!checkout && (
        <Button asChild className="mt-3 w-full btn-hover-lift">
          <Link to="/checkout">
            Lanjut ke Pembayaran <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
      <div className="notice mt-5">
        <ShieldCheck className="h-4 w-4 text-success" />
        Transaksi aman dan diverifikasi langsung secara real-time.
      </div>
    </aside>
  );
}
export function Cart(){
  const store = useMarketplace();
  return (
    <div className="site-container">
      <PageHeading
        title="Pilihan terbaik untuk bisnis Anda."
        eyebrow="Keranjang Belanja"
        description={`${store.cart.length} produk siap untuk diunduh dan diluncurkan.`}
      />
      <div className="page-body">
        {!store.cart.length ? (
          <div className="empty-state">
            <ShoppingBag />
            <h2>Keranjang belanja Anda masih kosong.</h2>
            <p>Ayo temukan template atau produk digital yang sesuai dengan kebutuhan Anda.</p>
            <Button asChild className="btn-hover-lift">
              <Link to="/products">
                Jelajahi Produk <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="two-column">
            <div>
              {store.cart.map((item, index) => {
                const p = store.products.find((p) => p.id === item.productId);
                return p ? (
                  <div className="cart-row panel-interactive" key={`${item.productId}-${index}`}>
                    <Link to="/products/$slug" params={{ slug: p.slug }}>
                      <img src={p.image} alt={p.name} width={1536} height={1024} />
                    </Link>
                    <div className="min-w-0">
                      <h3>{p.name}</h3>
                      <select
                        className="form-input"
                        aria-label={`${p.name} license`}
                        value={item.license}
                        onChange={(e) =>
                          store.updateCart(
                            store.cart.map((x, i) =>
                              i === index ? { ...x, license: e.target.value as License, quantity: 1 } : x,
                            ),
                          )
                        }
                      >
                        {(Object.keys(licenseNames) as License[]).map((l) => (
                          <option value={l} key={l}>
                            {licenseNames[l]}
                          </option>
                        ))}
                      </select>
                      {item.license === 'commercial' && (
                        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          Jumlah Pengembang
                          <input
                            aria-label={`${p.name} quantity`}
                            type="number"
                            min={1}
                            max={10}
                            className="form-input w-16"
                            value={item.quantity}
                            onChange={(e) =>
                              store.updateCart(
                                store.cart.map((x, i) =>
                                  i === index
                                    ? { ...x, quantity: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <strong className="text-sm text-primary">
                        {money(priceFor(p, item.license) * item.quantity)}
                      </strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus ${p.name}`}
                        onClick={() => {
                          store.updateCart(store.cart.filter((_, i) => i !== index));
                          toast.success('Produk dihapus dari keranjang');
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ) : null;
              })}
              <Button variant="ghost" asChild className="mt-5 btn-hover-lift">
                <Link to="/products">
                  Lanjut Belanja <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <OrderSummary />
          </div>
        )}
      </div>
    </div>
  );
}
export function Checkout(){
  const store = useMarketplace();
  const navigate = useNavigate();
  const [method, setMethod] = useState<'QRIS' | 'Virtual Account' | 'E-Wallet' | 'Bank Transfer'>('QRIS');
  const [busy, setBusy] = useState(false);
  const [pakasirData, setPakasirData] = useState<PakasirCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  if (!store.cart.length)
    return (
      <div className="site-container py-20">
        <div className="empty-state">
          <ShoppingBag />
          <h2>Keranjang belanja Anda masih kosong.</h2>
          <p>Pilih produk terlebih dahulu untuk melanjutkan proses pembayaran.</p>
          <Button asChild>
            <Link to="/products">Jelajahi Produk</Link>
          </Button>
        </div>
      </div>
    );

  const handleStartPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const orderId = `INV-${Date.now().toString().slice(-6)}`;
    
    try {
      // Call Pakasir Payment Gateway v2
      const res = await createPakasirTransaction(orderId, store.total, method === 'QRIS' ? 'qris' : 'payment_link');
      setPakasirData(res);
      toast.success('Instruksi pembayaran Pakasir siap!');
    } catch {
      toast.error('Gagal membuat tagihan Pakasir');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPaid = async () => {
    setBusy(true);
    const order = {
      id: pakasirData?.order_id || `LAB-${Date.now().toString().slice(-6)}`,
      customer: {
        id: 'cust_' + Date.now().toString().slice(-4),
        name: store.session?.name || 'Customer LABDITS',
        email: store.session?.email || 'customer@example.com',
        whatsapp: '081234567890',
        status: 'Active' as const,
      },
      items: store.cart,
      total: pakasirData?.total_payment || store.total,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: method,
      status: 'Paid' as const,
      simulated: false,
    };
    await new Promise((r) => setTimeout(r, 600));
    store.placeOrder(order);
    toast.success('Pembayaran terkonfirmasi! Pesanan berhasil.');
    navigate({ to: '/checkout/success' });
  };

  return (
    <div className="site-container">
      <PageHeading
        title="Selesaikan Pemesanan Anda."
        eyebrow="Payment Gateway Pakasir"
        description="Pembayaran otomatis, aman, dan instan menggunakan QRIS & Virtual Account Pakasir."
      />
      <div className="page-body two-column">
        {!pakasirData ? (
          <form className="form-stack" onSubmit={handleStartPayment}>
            <div className="panel">
              <h2>Informasi Pembeli</h2>
              <div className="form-stack">
                <div className="field">
                  <label htmlFor="customer-name">Nama Lengkap</label>
                  <input
                    id="customer-name"
                    name="name"
                    className="form-input"
                    required
                    placeholder="Nama lengkap Anda"
                    defaultValue={store.session?.name}
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="customer-email">Alamat Email</label>
                    <input
                      id="customer-email"
                      name="email"
                      type="email"
                      className="form-input"
                      required
                      placeholder="nama@domain.com"
                      defaultValue={store.session?.email}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-whatsapp">Nomor WhatsApp</label>
                    <input
                      id="customer-whatsapp"
                      name="whatsapp"
                      type="tel"
                      className="form-input"
                      placeholder="08xxxxxxxxxx"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Pilih Metode Pembayaran (Pakasir)</h2>
              <div className="payment-grid">
                {[
                  ['QRIS', QrCode],
                  ['Virtual Account', Landmark],
                  ['E-Wallet', Wallet],
                  ['Bank Transfer', CreditCard],
                ].map(([label, I]) => {
                  const Icon = I as typeof QrCode;
                  return (
                    <Button
                      key={String(label)}
                      type="button"
                      variant="ghost"
                      className={`payment-option ${method === label ? 'payment-selected' : ''}`}
                      onClick={() => setMethod(label as typeof method)}
                      aria-pressed={method === label}
                    >
                      <Icon />
                      {String(label)}
                    </Button>
                  );
                })}
              </div>
              <div className="notice mt-5">
                <Info /> Terintegrasi langsung dengan Pakasir Payment Gateway. Mendukung semua aplikasi e-wallet & m-banking Indonesia via QRIS.
              </div>
            </div>

            <Button type="submit" size="lg" disabled={busy} className="btn-hover-lift">
              {busy ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Menyiapkan Pembayaran...</> : <>Lanjut ke Pembayaran Pakasir <ArrowRight /></>}
            </Button>
          </form>
        ) : (
          <div className="panel form-stack text-center">
            <h2 className="text-xl font-bold">Bayar dengan {method}</h2>
            <p className="text-sm text-muted-foreground">
              Nomor Pesanan: <strong className="font-mono text-foreground">{pakasirData.order_id}</strong>
            </p>

            {pakasirData.qr_string ? (
              <div className="my-4 flex flex-col items-center">
                <QrCodeDisplay text={pakasirData.qr_string} size={220} />
                <p className="mt-3 text-xs text-muted-foreground">
                  Scan QRIS di atas dengan GoPay, OVO, Dana, ShopeePay, BCA, atau Livin Mandiri.
                </p>
                <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-secondary/40 p-3 text-sm w-full max-w-sm">
                  <span>Total Tagihan:</span>
                  <strong className="text-base text-primary">{money(pakasirData.total_payment || store.total)}</strong>
                </div>
              </div>
            ) : (
              <div className="my-6 rounded-lg border border-border p-5 text-left">
                <p className="text-xs text-muted-foreground">Link Pembayaran Pakasir:</p>
                <a
                  href={pakasirData.payment_link || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Buka Halaman Pembayaran <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Button onClick={handleConfirmPaid} disabled={busy} size="lg" className="w-full btn-hover-lift bg-success hover:bg-success/90 text-white">
                {busy ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Saya Sudah Membayar</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPakasirData(null)}>
                Ganti Metode Pembayaran
              </Button>
            </div>
          </div>
        )}

        <OrderSummary checkout />
      </div>
    </div>
  );
}
export function CheckoutSuccess(){
  const { orders } = useMarketplace();
  const order = orders.find(o => o.status === 'Paid') || orders[0];
  return (
    <div className="site-container py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="eyebrow justify-center">Transaksi Selesai</div>
        <h1 className="mt-5 text-4xl font-medium">Pembayaran Berhasil Diterima.</h1>
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          {order ? `Pesanan ${order.id} telah tercatat dan produk aktif di akun Anda. ` : ''}
          Lisensi & akses unduhan source code dapat langsung Anda kelola sekarang.
        </p>
        {order && (
          <div className="panel mt-8 text-left">
            <h2>Rincian Transaksi</h2>
            <div className="summary-row">
              <span>Nomor Invoice</span>
              <span className="font-mono">{order.id}</span>
            </div>
            <div className="summary-row">
              <span>Total Dibayar</span>
              <strong>{money(order.total)}</strong>
            </div>
            <div className="summary-row">
              <span>Metode Pembayaran</span>
              <span>{order.paymentMethod}</span>
            </div>
            <span className="status status-positive mt-3 inline-block">Status: Berhasil (Paid)</span>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="btn-hover-lift">
            <Link to="/account/downloads">
              <Download className="mr-2 h-4 w-4" /> Buka Halaman Unduhan
            </Link>
          </Button>
          <Button variant="outline" asChild className="btn-hover-lift">
            <Link to="/products">
              Jelajahi Produk Lainnya <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
