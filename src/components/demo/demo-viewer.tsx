import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  RotateCw,
  Maximize,
  ExternalLink,
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Check,
  Info,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/site-layout";
import { useMarketplace } from "@/hooks/use-marketplace";
import { chartData, money } from "@/data/products";
import type { Product } from "@/types";
import { resolvePublicDemo, shouldShowBundledDemo } from '@/lib/public-demo';
import { currentStatus, statusLabel } from "@/components/admin/project-uploader";
const VIEWPORTS: Record<string, string> = {
  Desktop: "1440px",
  Laptop: "1024px",
  Tablet: "768px",
  Mobile: "390px",
};
export function DemoViewer({ slug }: { slug: string }) {
  const { products, addToCart, session, hydrated } = useMarketplace();
  const [device, setDevice] = useState("Desktop"),
    [refresh, setRefresh] = useState(0),
    [external, setExternal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!hydrated) {
    return (
      <div className="site-container py-24 text-center">
        <div className="mx-auto max-w-md panel">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <h2 className="text-lg font-semibold">Memuat Live Demo...</h2>
          <p className="mt-2 text-xs text-muted-foreground">Menghubungkan ke pratinjau aplikasi interaktif LABDITS.</p>
        </div>
      </div>
    );
  }

  const normalized = decodeURIComponent(slug).trim().toLowerCase();
  const p = products.find(
    (item) =>
      (item.slug.toLowerCase() === normalized ||
        item.id.toLowerCase() === normalized ||
        item.name.toLowerCase() === normalized ||
        (normalized === "camber" && (item.id === "3" || item.slug.toLowerCase() === "demo7"))) &&
      (item.status === "published" || session?.role === "owner" || Boolean(resolvePublicDemo(item) || shouldShowBundledDemo(item))),
  ) || products.find(
    (item) =>
      item.slug.toLowerCase() === normalized ||
      item.id.toLowerCase() === normalized ||
      item.name.toLowerCase() === normalized ||
      (normalized === "camber" && (item.id === "3" || item.slug.toLowerCase() === "demo7")),
  );

  if (!p)
    return (
      <div className="site-container py-20">
        <div className="mx-auto max-w-lg panel text-center">
          <h1 className="text-2xl font-bold">Demo Tidak Tersedia</h1>
          <p className="my-4 text-sm text-muted-foreground">
            Aplikasi demo dengan tautan &ldquo;{slug}&rdquo; tidak ditemukan atau belum dipublikasikan ke katalog.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link to="/products">Kembali ke Etalase</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Beranda</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  const dep = p.project?.deployment;
  const url = resolvePublicDemo(p);
  const bundled = shouldShowBundledDemo(p);
  const hasProjectSource = Boolean(p.project || p.files?.length);
  const blocked = external || (url === dep?.previewUrl && dep.embeddable === false);
  const width = VIEWPORTS[device] ?? "100%";
  return (
    <div className="demo-page">
      <header className="demo-toolbar">
        <div className="demo-brand">
          <Brand />
          <p>
            {p.name}
            <span className="ml-2 text-muted-foreground">/ Live demo</span>
          </p>
        </div>
        <div className="device-tabs">
          {[
            ["Desktop", Monitor],
            ["Laptop", Laptop],
            ["Tablet", Tablet],
            ["Mobile", Smartphone],
          ].map(([d, I]) => {
            const Icon = I as typeof Monitor;
            return (
              <Button
                key={String(d)}
                variant="ghost"
                size="icon"
                title={`${d} preview`}
                aria-label={`${d} preview`}
                aria-pressed={device === d}
                className={device === d ? "device-active" : ""}
                onClick={() => setDevice(String(d))}
              >
                <Icon />
              </Button>
            );
          })}
        </div>
        <div className="demo-actions flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Muat ulang pratinjau"
            aria-label="Muat ulang pratinjau"
            onClick={() => {
              setRefresh((x) => x + 1);
              toast.success("Pratinjau dimuat ulang");
            }}
          >
            <RotateCw />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Layar penuh"
            aria-label="Layar penuh"
            onClick={() => {
              if (ref.current?.requestFullscreen)
                ref.current
                  .requestFullscreen()
                  .catch(() => toast.info("Mode layar penuh tidak didukung peramban ini."));
              else toast.info("Mode layar penuh tidak didukung peramban ini.");
            }}
          >
            <Maximize />
          </Button>
          {url && (
            <Button variant="ghost" size="icon" asChild>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Buka live demo eksternal"
                aria-label="Buka live demo eksternal"
              >
                <ExternalLink />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/products/$slug"
              params={{ slug: p.slug }}
              title="Kembali ke produk"
              aria-label="Kembali ke produk"
            >
              <ArrowLeft />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/checkout" onClick={() => addToCart(p.id)}>
              Beli proyek
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </header>
      <div className="demo-stage" ref={ref}>
        <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground">
          <span>
            {url ? (
              <>
                {url === dep?.previewUrl ? "Pratinjau deployment" : "Pratinjau tertanam eksternal"} ·{" "}
                <a
                  className="font-mono text-primary underline"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {url}
                </a>
              </>
            ) : (
              <>
                Pratinjau: <strong>{bundled ? "Demo interaktif bawaan" : "Demo publik belum siap"}</strong>
                {hasProjectSource && (
                  <>
                    {" "}
                    · Status build: {p.project ? statusLabel[currentStatus(p.project)] : "belum terhubung"}
                  </>
                )}
              </>
            )}
          </span>
          <span>
            {device} / {width}
          </span>
          {url && (
            <Button variant="link" size="sm" onClick={() => setExternal(true)}>
              Pratinjau tidak termuat?
            </Button>
          )}
        </div>
        {blocked && url && (
          <div className="notice mx-auto mb-5 max-w-6xl">
            <Info />
            <span>
              Aplikasi ini membatasi pratinjau tertanam (X-Frame-Options atau CSP frame-ancestors).{" "}
              <a href={url} target="_blank" rel="noreferrer" className="text-primary underline font-medium">
                Buka Live Demo
              </a>{" "}
              di tab baru.
            </span>
          </div>
        )}
        <div
          className={`demo-frame ${device === "Mobile" ? "demo-mobile" : ""}`}
          style={{ width, maxWidth: "100%" }}
        >
          {url ? (
            <iframe
              key={refresh}
              src={url}
              title={`${p.name} live demo`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={() => setExternal(true)}
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : bundled ? (
            <MockApplication key={`${p.id}-${refresh}`} product={p} />
          ) : (
            <div className="mock-app" role="status">
              <h2>Demo publik belum siap</h2>
              <p>Unggah file saja belum meng-host website. Sambungkan URL demo HTTPS publik atau tunggu proses deployment terverifikasi sebelum dipublikasikan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export function MockApplication({ product: p }: { product: Product }) {
  const [tab, setTab] = useState("Ringkasan"),
    [query, setQuery] = useState(""),
    [tasks, setTasks] = useState([
      { name: "Desain homepage baru", status: 0 },
      { name: "Buat reusable components", status: 1 },
      { name: "Tinjau arah visual brand", status: 2 },
      { name: "Siapkan checklist peluncuran", status: 0 },
    ]),
    [order, setOrder] = useState<string[]>([]),
    [period, setPeriod] = useState("Bulan ini");
  const addTask = () => {
    const name = window.prompt("Nama tugas");
    if (name?.trim()) setTasks((t) => [...t, { name: name.trim(), status: 0 }]);
  };
  const isPOS = p.category === "POS Systems",
    isTask = p.category === "SaaS Applications";
  return (
    <div className="mock-app">
      <div className="mock-app-header">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            {p.name.slice(0, 1)}
          </span>
          <span className="truncate">{p.name}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info("Anda sedang menjelajahi simulasi demo interaktif bawaan.")}
        >
          Pratinjau antarmuka
        </Button>
      </div>
      <div className="chips">
        {["Ringkasan", isPOS ? "Point of Sale" : isTask ? "Papan Tugas" : "Transaksi", "Laporan"].map(
          (t) => (
            <Button
              variant="ghost"
              className={`chip ${tab === t ? "chip-active" : ""}`}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ),
        )}
      </div>
      <div className="mock-app-header">
        <h1>{isPOS ? "Point of Sale (Kasir)" : isTask ? "Manajemen Proyek" : tab}</h1>
        {isTask ? (
          <Button onClick={addTask} size="sm">
            <Plus />
            Tugas baru
          </Button>
        ) : (
          <select
            className="form-input"
            aria-label="Rentang waktu demo"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Bulan ini</option>
            <option>Bulan lalu</option>
            <option>Tahun ini</option>
          </select>
        )}
      </div>
      {isTask ? (
        <div className="mock-kanban">
          {["Rencana", "Dikerjakan", "Selesai"].map((label, i) => (
            <div className="mock-kanban-column" key={label}>
              <h3>
                {label} · {tasks.filter((t) => t.status === i).length}
              </h3>
              {tasks
                .filter((t) => t.status === i)
                .map((t) => (
                  <div className="mock-task" key={t.name}>
                    <p>{t.name}</p>
                    <span className="status mt-3">{i === 2 ? "Selesai" : "Prioritas Menengah"}</span>
                    <Button
                      variant="ghost"
                      className="mt-3 w-full"
                      size="sm"
                      onClick={() =>
                        setTasks((x) =>
                          x.map((a) => (a === t ? { ...a, status: (a.status + 1) % 3 } : a)),
                        )
                      }
                    >
                      {i === 2 ? "Buka kembali" : "Lanjut tahap"}
                      <ArrowUpRight />
                    </Button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      ) : isPOS ? (
        <>
          <div className="two-column">
            <div className="grid grid-cols-2 gap-3">
              {[
                "Iced Latte",
                "Cappuccino",
                "Croissant",
                "Matcha Latte",
                "Espresso",
                "Chocolate Donut",
              ].map((item, i) => (
                <Button
                  variant="outline"
                  className="h-32 flex-col"
                  key={item}
                  onClick={() => setOrder((o) => [...o, item])}
                >
                  <span className="text-3xl font-light text-primary">
                    {["IL", "CA", "CR", "MA", "ES", "CD"][i]}
                  </span>
                  {item}
                  <span className="text-muted-foreground">{money(25000 + i * 5000)}</span>
                </Button>
              ))}
            </div>
            <div className="panel">
              <h2>Pesanan saat ini</h2>
              {order.length ? (
                order.map((o, i) => (
                  <div className="summary-row" key={i}>
                    <span>{o}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOrder((x) => x.filter((_, j) => j !== i))}
                    >
                      Hapus
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Pilih menu untuk memulai pesanan.</p>
              )}
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>
                  {money(
                    order.reduce(
                      (s, o) =>
                        s +
                        25000 +
                        [
                          "Iced Latte",
                          "Cappuccino",
                          "Croissant",
                          "Matcha Latte",
                          "Espresso",
                          "Chocolate Donut",
                        ].indexOf(o) *
                          5000,
                      0,
                    ),
                  )}
                </strong>
              </div>
              <Button
                className="w-full"
                disabled={!order.length}
                onClick={() => {
                  setOrder([]);
                  toast.success("Transaksi simulasi kasir selesai. Tidak ada tagihan riil.");
                }}
              >
                Selesaikan transaksi demo
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="metric-grid">
            {[
              ["Total saldo", period === "Bulan lalu" ? "Rp 98.420.000" : "Rp 124.850.000"],
              ["Total pendapatan", period === "Tahun ini" ? "Rp 342.400.000" : "Rp 32.400.000"],
              ["Total pengeluaran", "Rp 18.250.000"],
            ].map(([label, value]) => (
              <div className="panel metric" key={label}>
                <span className="metric-label">{label}</span>
                <strong>{value}</strong>
                <small>+12.8% dibanding periode lalu</small>
              </div>
            ))}
          </div>
          {tab !== "Transaksi" && tab !== "Transactions" && (
            <div className="panel">
              <h2>{tab === "Laporan" || tab === "Reports" ? "Laporan pendapatan" : "Ringkasan pendapatan"}</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.13}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="mt-5 panel">
            <div className="mock-app-header">
              <h2>Transaksi terbaru</h2>
              <div className="search-field">
                <Search />
                <input
                  className="form-input"
                  aria-label="Cari transaksi demo"
                  placeholder="Cari transaksi..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Kategori</th>
                    <th>Nominal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {["Langganan Desain", "Pembayaran Klien", "Kebutuhan Kantor", "Faktur Proyek"]
                    .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                    .map((name, i) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{i % 2 ? "Pendapatan" : "Operasional"}</td>
                        <td>{money(250000 + i * 1750000)}</td>
                        <td>
                          <span className="status status-positive">Selesai</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div className="notice mt-6">
        <Info />
        Pratinjau interaktif bawaan. Perubahan hanya berlaku selama sesi ini dan akan tereset saat dimuat ulang.
      </div>
    </div>
  );
}
