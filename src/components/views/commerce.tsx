import { useState, useId, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  ShoppingBag,
  Trash2,
  ShieldCheck,
  Info,
  CheckCircle2,
  Download,
  CreditCard,
  QrCode,
  Landmark,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/views/marketplace';
import { useMarketplace } from '@/hooks/use-marketplace';
import { money, licenseNames, priceFor } from '@/data/products';
import { createQrisgateCheckout } from '@/services/qrisgate-service';
import { supabase } from '@/integrations/supabase/client';
import { catalogConfigured } from '@/services/catalog-service';
import type { License, Order } from '@/types';

export function OrderSummary({ checkout = false }: { checkout?: boolean }) {
  const store = useMarketplace();
  return (
    <aside className="panel">
      <h2>Ringkasan Pesanan</h2>
      {store.cart.map((i, n) => {
        const p = store.products.find((p) => p.id === i.productId);
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
          {store.session ? (
            <Link to="/checkout">
              Lanjut ke Pembayaran <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          ) : (
            <Link to="/login" search={{ redirect: '/checkout' }}>
              Masuk untuk Checkout <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          )}
        </Button>
      )}
      <div className="notice mt-5">
        <ShieldCheck className="h-4 w-4 text-success" />
        Transaksi resmi, aman, dan lisensi terikat langsung ke akun Anda.
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
        {!store.session && store.cart.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                Anda belum masuk. Silakan <strong>login</strong> terlebih dahulu sebelum checkout agar lisensi otomatis terkait dengan akun Anda.
              </p>
            </div>
            <Button size="sm" asChild className="shrink-0 btn-hover-lift">
              <Link to="/login" search={{ redirect: '/checkout' }}>
                Masuk Sekarang
              </Link>
            </Button>
          </div>
        )}
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
export function Checkout() {
  const store = useMarketplace();
  const navigate = useNavigate();

  // Settings
  const paymentMode = store.settings['payment_mode'] || 'manual';
  const useQrisgate = paymentMode === 'qrisgate';
  const manualMode = paymentMode === 'manual';
  const gatewayConfigured = catalogConfigured();
  const [gatewayMethod, setGatewayMethod] = useState<'QRIS' | 'BANK_TRANSFER'>('QRIS');
  const adminWhatsapp = store.settings['admin_whatsapp'] || '085882846665';
  const cleanAdminWa = adminWhatsapp.replace(/\D/g, '').replace(/^0/, '62');
  const qrisNmid = store.settings['qris_nmid'] || 'ID1026491254490';
  const qrisMerchant = store.settings['qris_merchant'] || 'DITSSTORE - SOFTWARE';
  const bankName = store.settings['bank_name'] || 'SeaBank';
  const bankNumber = store.settings['bank_account_number'] || '9014 7615 4832';
  const bankHolder = store.settings['bank_account_name'] || 'Muhammad Raditya Anwar';

  // State
  const [orderId] = useState(() => `INV-${Date.now().toString().slice(-6)}`);
  const [buyerName, setBuyerName] = useState(store.session?.name || '');
  const [buyerEmail, setBuyerEmail] = useState(store.session?.email || '');
  const [buyerWa, setBuyerWa] = useState('');
  const [copiedRekening, setCopiedRekening] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store.session) {
      if (!buyerName && store.session.name) setBuyerName(store.session.name);
      if (!buyerEmail && store.session.email) setBuyerEmail(store.session.email);
    }
  }, [store.session]);


  // Loading state during initial hydration
  if (!store.hydrated) {
    return (
      <div className="site-container py-24 text-center">
        <div className="mx-auto max-w-md panel">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <h2 className="text-lg font-semibold">Memuat Data Pembayaran...</h2>
          <p className="mt-2 text-xs text-muted-foreground">Menghubungkan ke layanan checkout LABDITS.</p>
        </div>
      </div>
    );
  }

  // Guard 1: Empty cart
  if (!store.cart.length) {
    return (
      <div className="site-container py-20">
        <div className="empty-state">
          <ShoppingBag />
          <h2>Keranjang belanja Anda masih kosong.</h2>
          <p>Pilih produk terlebih dahulu untuk melanjutkan proses pembayaran.</p>
          <Button asChild className="btn-hover-lift">
            <Link to="/products">Jelajahi Produk</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Guard 2: Must be logged in before purchasing
  if (!store.session) {
    return (
      <div className="site-container py-16">
        <div className="mx-auto max-w-lg panel text-center py-12 px-6">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <div className="eyebrow justify-center mb-2">Autentikasi Diperlukan</div>
          <h1 className="text-2xl font-bold">Wajib Masuk Sebelum Membeli</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Untuk menerbitkan invoice resmi, mencatat lisensi software, dan mengamankan akses unduhan source code aplikasi di dashboard Anda, Anda wajib memiliki akun aktif.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild size="lg" className="w-full btn-hover-lift">
              <Link to="/login" search={{ redirect: '/checkout' }}>
                Masuk ke Akun Saya <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="w-full">
              <Link to="/login" search={{ redirect: '/checkout' }}>
                Daftar Akun Baru
              </Link>
            </Button>
          </div>
          <div className="mt-6 pt-5 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Pembayaran diverifikasi oleh server; akses produk menunggu penerbitan hak unduh.
          </div>
        </div>
      </div>
    );
  }

  // Build WhatsApp report template
  const itemsText = store.cart
    .map((item) => {
      const p = store.products.find((x) => x.id === item.productId);
      return `• ${p?.name || 'Produk'} (${licenseNames[item.license]} · ${item.quantity}x) = ${money(
        (p ? priceFor(p, item.license) : 0) * item.quantity,
      )}`;
    })
    .join('\n');

  const waMessage = `Halo Admin DITSSTORE, saya ingin konfirmasi pembayaran pesanan template:

No. Invoice: ${orderId}
Nama Pembeli: ${buyerName || store.session?.name}
Email: ${buyerEmail || store.session?.email}
WhatsApp: ${buyerWa || '-'}

Rincian Pembelian:
${itemsText}

Total Pembayaran: ${money(store.total)}
Metode Pembayaran: QRIS Manual DITSSTORE / SeaBank

Saya telah melakukan pembayaran dan melampirkan foto bukti transfer pada chat ini. Mohon diverifikasi (acc) di dashboard admin agar akses unduhan source code segera aktif. Terima kasih!`;

  const waUrl = `https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(waMessage)}`;

  const handleCopyRekening = () => {
    navigator.clipboard.writeText(bankNumber.replace(/\s+/g, ''));
    setCopiedRekening(true);
    toast.success('Nomor rekening SeaBank berhasil disalin!');
    setTimeout(() => setCopiedRekening(false), 2500);
  };

  const handleConfirmManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerWa.trim()) {
      toast.error('Mohon masukkan nomor WhatsApp Anda agar admin dapat mencocokkan pembayaran.');
      return;
    }

    setBusy(true);
    const newOrder: Order = {
      id: orderId,
      customer: {
        id: 'cust_' + (store.session?.email?.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString().slice(-4)),
        name: buyerName || store.session?.name || 'Pelanggan',
        email: buyerEmail || store.session?.email || '',
        whatsapp: buyerWa,
        status: 'Active',
      },
      items: store.cart,
      total: store.total,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'QRIS Manual (DITSSTORE)',
      status: 'Pending',
      simulated: false,
    };

    await new Promise((r) => setTimeout(r, 400));
    store.placeOrder(newOrder);
    setBusy(false);
    toast.success('Pesanan berhasil dibuat! Segera kirimkan bukti transfer ke WhatsApp admin.');
    void navigate({ to: '/checkout/success' });
  };

  const handleStartAutomaticPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!useQrisgate || !gatewayConfigured) {
      toast.error('Gateway QRISGate memerlukan backend Supabase yang aktif.');
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const order = await createQrisgateCheckout({
        items: store.cart.map(({ productId, license, quantity }) => ({ productId, license, quantity })),
        customer_name: buyerName.trim(),
        customer_whatsapp: buyerWa.trim(),
        payment_method: gatewayMethod,
      }, session?.access_token || null);
      if (!order.checkout_url.startsWith('https://qrisgate.web.id/pay/')) throw new Error('URL pembayaran gateway tidak valid.');
      // Order is created server-side; the browser must never mark it Paid.
      window.location.assign(order.checkout_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat tagihan QRISGate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="site-container">
      <PageHeading
        title="Selesaikan Pemesanan Anda."
        eyebrow={manualMode ? 'Pembayaran QRIS & Transfer Bank' : 'Payment Gateway'}
        description={manualMode ? 'Scan QRIS DITSSTORE atau transfer SeaBank, lalu kirim bukti transfer ke WhatsApp admin.' : 'Pembayaran otomatis melalui QRISGate; status lunas diverifikasi oleh server.'}
      />
      <div className="page-body two-column">
        {manualMode ? (
          <form className="form-stack" onSubmit={handleConfirmManualPayment}>
            {/* Customer Details */}
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
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="customer-email">Alamat Email Terdaftar</label>
                    <input
                      id="customer-email"
                      name="email"
                      type="email"
                      className="form-input"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-whatsapp">Nomor WhatsApp Pembeli (Wajib)</label>
                    <input
                      id="customer-whatsapp"
                      name="whatsapp"
                      type="tel"
                      className="form-input"
                      placeholder="cth. 081234567890"
                      required
                      value={buyerWa}
                      onChange={(e) => setBuyerWa(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Digunakan untuk mencocokkan konfirmasi chat transfer Anda dengan akun ini.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* QRIS & SeaBank Presentation */}
            <div className="panel">
              <div className="flex items-center justify-between">
                <h2>Metode Pembayaran Resmi</h2>
                <span className="font-mono text-xs text-primary font-semibold">{orderId}</span>
              </div>

              {/* QRIS Card with uploaded Banner */}
              <div className="mt-4 rounded-xl border border-primary/20 bg-card p-5 text-center">
                <div className="inline-block rounded-lg overflow-hidden border border-border shadow-md max-w-[280px] mx-auto bg-black">
                  <img
                    src="/payments/qris-ditsstore.jpg"
                    alt="DITSSTORE QRIS Payment"
                    className="w-full h-auto object-contain"
                  />
                </div>

                <div className="mt-4 flex flex-col items-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    <QrCode className="h-3.5 w-3.5" /> {qrisMerchant}
                  </div>
                  <p className="mt-2 text-xs font-mono text-muted-foreground">
                    NMID: {qrisNmid} · A01
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mendukung BCA, Mandiri, BRI, BNI, GoPay, OVO, Dana, ShopeePay, LinkAja.
                  </p>
                </div>

                <div className="mt-5 rounded-lg bg-secondary/50 p-3 flex items-center justify-between text-sm">
                  <span>Nominal yang Harus Ditransfer:</span>
                  <strong className="text-base text-primary font-bold">{money(store.total)}</strong>
                </div>
              </div>

              {/* Alternative SeaBank Option */}
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Opsi Transfer Bank ({bankName})</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleCopyRekening}
                  >
                    {copiedRekening ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedRekening ? 'Tersalin' : 'Salin No. Rekening'}
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Nomor Rekening:</span>
                    <p className="font-mono text-sm font-bold text-foreground mt-0.5">{bankNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Atas Nama:</span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">{bankHolder}</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-5 rounded-lg bg-accent/40 p-4 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground block mb-1">Langkah Pembayaran Manual:</strong>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Scan QRIS di atas atau transfer ke rekening SeaBank.</li>
                  <li>Simpan screenshot / foto struk bukti transfer Anda.</li>
                  <li>Klik tombol hijau <strong>"Kirim Bukti Pembayaran ke WhatsApp Admin"</strong> di bawah.</li>
                  <li>Admin akan memverifikasi (acc) di dashboard, dan akses unduhan source code otomatis terbuka.</li>
                </ol>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                size="lg"
                className="w-full btn-hover-lift bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-sm"
                onClick={() => {
                  if (!buyerWa.trim()) {
                    toast.error('Mohon isi nomor WhatsApp pembeli terlebih dahulu di formulir atas.');
                    return;
                  }
                  window.open(waUrl, '_blank');
                  toast.success('Membuka WhatsApp Admin...');
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                1. Kirim Bukti Pembayaran ke WhatsApp Admin ({adminWhatsapp})
              </Button>

              <Button
                type="submit"
                size="lg"
                disabled={busy}
                className="w-full btn-hover-lift bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" /> Memproses Pesanan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    2. Saya Sudah Mengirim Bukti Transfer ke WhatsApp
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form className="form-stack" onSubmit={handleStartAutomaticPayment}>
              <div className="panel">
                <h2>Informasi Pembeli</h2>
                <div className="form-stack">
                  <div className="field">
                    <label htmlFor="auto-customer-name">Nama Lengkap</label>
                    <input
                      id="auto-customer-name"
                      name="name"
                      className="form-input"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                    />
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="auto-customer-email">Email akun untuk pesanan</label>
                      <input
                        id="auto-customer-email"
                        name="email"
                        type="email"
                        className="form-input"
                        readOnly
                        value={store.session?.email || ''}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Email diambil dari akun yang sedang masuk, bukan dari isian checkout.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="auto-customer-whatsapp">Nomor WhatsApp</label>
                      <input
                        id="auto-customer-whatsapp"
                        name="whatsapp"
                        type="tel"
                        className="form-input"
                        placeholder="08xxxxxxxxxx"
                        required
                        value={buyerWa}
                        onChange={(e) => setBuyerWa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h2>Pilih Metode Pembayaran Otomatis</h2>
                <div className="payment-grid">
                  {(['QRIS', 'BANK_TRANSFER'] as const).map((method) => (
                    <Button key={method} type="button" variant="ghost"
                      className={`payment-option ${gatewayMethod === method ? 'payment-selected' : ''}`}
                      onClick={() => setGatewayMethod(method)} aria-pressed={gatewayMethod === method}>
                      {method === 'QRIS' ? <QrCode /> : <Landmark />}
                      {method === 'QRIS' ? 'QRIS' : 'Transfer Bank'}
                    </Button>
                  ))}
                </div>
                <div className="notice mt-5">
                  <Info /> QRISGate menambahkan kode unik ke total tagihan. Bayar nominal tepat pada halaman QRISGate; pesanan berlaku 15 menit.
                </div>
              </div>

              <Button type="submit" size="lg" disabled={busy || !useQrisgate || !gatewayConfigured} className="btn-hover-lift">
                {busy ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" /> Menyiapkan Pembayaran...
                  </>
                ) : (
                  <>
                    Lanjut ke Pembayaran Otomatis <ArrowRight />
                  </>
                )}
              </Button>
              {(!useQrisgate || !gatewayConfigured) && <p role="alert" className="text-xs text-amber-500">Gateway belum aktif. Admin perlu memilih QRISGate dan menyiapkan backend Supabase terlebih dahulu.</p>}
            </form>
        )}

        <OrderSummary checkout />
      </div>
    </div>
  );
}

export function CheckoutSuccess() {
  const store = useMarketplace();
  const adminWhatsapp = store.settings['admin_whatsapp'] || '085882846665';
  const cleanAdminWa = adminWhatsapp.replace(/\D/g, '').replace(/^0/, '62');

  // Find the latest order for this customer
  const ownOrders = store.orders.filter((o) => o.customer.email === store.session?.email);
  const latestOrder = ownOrders[0] || store.orders[0];
  const isPending = latestOrder?.status === 'Pending';

  return (
    <div className="site-container py-16">
      <div className="mx-auto max-w-xl text-center">
        <div
          className={`mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full ${
            isPending ? 'bg-amber-500/15 text-amber-500' : 'bg-success/15 text-success'
          }`}
        >
          {isPending ? <Clock className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
        </div>
        <div className="eyebrow justify-center">
          {isPending ? 'Menunggu Konfirmasi Admin' : 'Transaksi Selesai'}
        </div>
        <h1 className="mt-5 text-3xl sm:text-4xl font-bold">
          {isPending ? 'Pesanan Berhasil Dicatat!' : 'Pembayaran Berhasil Diterima.'}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {isPending ? (
            <>
              Pesanan <strong>{latestOrder?.id}</strong> telah masuk ke antrean verifikasi admin. Pastikan Anda telah mengirimkan bukti transfer ke WhatsApp admin <strong>{adminWhatsapp}</strong>. Setelah disetujui (Acc), akses unduhan source code akan otomatis aktif.
            </>
          ) : (
            <>
              {latestOrder ? `Pesanan ${latestOrder.id} telah disetujui. ` : ''}
              Lisensi resmi dan akses unduhan source code aplikasi Anda telah aktif dan siap diunduh sekarang.
            </>
          )}
        </p>

        {latestOrder && (
          <div className="panel mt-8 text-left">
            <h2>Rincian Pesanan</h2>
            <div className="summary-row">
              <span>Nomor Invoice</span>
              <span className="font-mono font-semibold">{latestOrder.id}</span>
            </div>
            <div className="summary-row">
              <span>Total Pembayaran</span>
              <strong className="text-primary">{money(latestOrder.total)}</strong>
            </div>
            <div className="summary-row">
              <span>Metode Pembayaran</span>
              <span>{latestOrder.paymentMethod}</span>
            </div>
            <div className="summary-row">
              <span>Status Pesanan</span>
              <span
                className={`status ${
                  isPending ? 'status-pending' : 'status-positive'
                }`}
              >
                {isPending ? 'Menunggu Verifikasi Admin (Pending)' : 'Lunas & Disetujui (Paid)'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isPending ? (
            <>
              <Button
                asChild
                size="lg"
                className="btn-hover-lift bg-[#25D366] hover:bg-[#20ba59] text-white"
              >
                <a
                  href={`https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(
                    `Halo Admin DITSSTORE, saya ingin konfirmasi transfer untuk pesanan ${latestOrder?.id || ''}. Mohon di-acc ya, terima kasih!`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Hubungi Admin di WhatsApp
                </a>
              </Button>
              <Button variant="outline" asChild size="lg" className="btn-hover-lift">
                <Link to="/account/orders">Lihat Pesanan Saya</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="btn-hover-lift">
                <Link to="/account/downloads">
                  <Download className="mr-2 h-4 w-4" /> Buka Halaman Unduhan
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="btn-hover-lift">
                <Link to="/products">
                  Jelajahi Produk Lainnya <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
