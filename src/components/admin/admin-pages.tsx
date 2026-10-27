import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Plus,
  ArrowUpRight,
  Package,
  Users,
  ShoppingBag,
  Banknote,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Download,
  Info,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProjectActions, ProjectCells } from "@/components/admin/project-admin";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useMarketplace } from "@/hooks/use-marketplace";
import { chartData, money, seedCustomers, licenseNames } from "@/data/products";
import { publishReadiness } from "@/lib/publish-readiness";
import type { Order, Product } from "@/types";
export function AdminHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="app-heading"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="min-w-0">
        <div className="eyebrow mb-3">LABDITS / OWNER WORKSPACE</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <Button asChild size="sm">
          <Link to="/admin/products/new">
            <Plus />
            Tambah produk
          </Link>
        </Button>
      )}
    </motion.div>
  );
}
export function Metrics() {
  const { products, orders } = useMarketplace();
  const reduced = useReducedMotion();
  const revenue = orders.filter((o) => o.status !== "Pending").reduce((s, o) => s + o.total, 0);
  return (
    <motion.div
      className="metric-grid"
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: reduced ? 1 : 0 },
        show: { opacity: 1, transition: { staggerChildren: reduced ? 0 : 0.08 } },
      }}
    >
      {[
        {
          label: "Total pendapatan",
          value: money(revenue),
          icon: Banknote,
          change: "+24.8% vs. bulan lalu",
        },
        {
          label: "Jumlah produk",
          value: products.length,
          icon: Package,
          change: `${products.filter((p) => p.status === "published").length} produk aktif tayang`,
        },
        {
          label: "Total pesanan",
          value: orders.length,
          icon: ShoppingBag,
          change: "+18.2% vs. bulan lalu",
        },
        {
          label: "Total Pelanggan",
          value: new Set(orders.map((o) => o.customer.email)).size,
          icon: Users,
          change: "Basis pelanggan bertumbuh",
        },
      ].map(({ label, value, icon: Icon, change }) => (
        <motion.div
          className="panel metric"
          key={label}
          variants={{ hidden: { opacity: 0, y: reduced ? 0 : 14 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.35 }}
          whileHover={reduced ? {} : { y: -3 }}
        >
          <div className="metric-label">
            {label}
            <Icon />
          </div>
          <strong>{value}</strong>
          <small>{change}</small>
        </motion.div>
      ))}
    </motion.div>
  );
}
export function RevenueChart({
  analytics = false,
  period = "6 months",
}: {
  analytics?: boolean;
  period?: string;
}) {
  const reduced = useReducedMotion();
  const data =
    period === "30 days"
      ? chartData.slice(-2)
      : period === "90 days"
        ? chartData.slice(-3)
        : chartData;
  return (
    <motion.div
      className="panel chart-panel"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-2">{analytics ? "Aktivitas Pengunjung & Produk" : "Grafik Pertumbuhan Omzet"}</h2>
          <p className="text-[10px] text-muted-foreground">
            {analytics ? "Jumlah kunjungan halaman produk" : "Pendapatan kotor dalam jutaan Rupiah (Rp)"}
          </p>
        </div>
        <span className="status status-positive">↗ 24.8%</span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          {analytics ? (
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: 6,
                  color: "var(--foreground)",
                }}
              />
              <Bar
                dataKey="views"
                fill="var(--cyan)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={!reduced}
              />
            </BarChart>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: 6,
                  color: "var(--foreground)",
                }}
              />
              <Area
                dataKey="revenue"
                type="monotone"
                fill="url(#revenueFill)"
                stroke="var(--primary)"
                strokeWidth={2}
                isAnimationActive={!reduced}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
export function AdminOverview() {
  const { products, orders } = useMarketplace();
  const reduced = useReducedMotion();
  return (
    <DashboardLayout owner title="Ringkasan">
      <AdminHeading
        title="Wujudkan Karya Digital Terbaik."
        description="Pantau produk, bisnis, dan analitik penjualan marketplace Anda."
        action
      />
      <Metrics />
      <motion.div
        className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
      >
        <RevenueChart />
        <motion.div className="panel" whileHover={reduced ? {} : { y: -3 }}>
          <h2>Produk Terlaris</h2>
          {products
            .slice()
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 4)
            .map((p, i) => (
              <motion.div
                key={p.id}
                initial={reduced ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.06 }}
              >
                <Link
                  to="/products/$slug"
                  params={{ slug: p.slug }}
                  className="flex items-center gap-3 border-b border-border py-4"
                >
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  <img src={p.image} alt="" className="h-9 w-12 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">{p.name}</p>
                    <p className="mt-1 text-[9px] text-muted-foreground">{p.category}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </motion.div>
            ))}
          <div className="summary-row mt-6">
            <span>Tingkat konversi</span>
            <strong className="text-success">4.8%</strong>
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        className="panel mt-6"
        initial={reduced ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
      >
        <div className="mb-4 flex justify-between">
          <h2>Transaksi Terbaru</h2>
          <Button variant="link" size="sm" asChild>
            <Link to="/admin/orders">
              Semua pesanan
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <OrdersTable orders={orders.slice(0, 5)} />
      </motion.div>
    </DashboardLayout>
  );
}
export function AdminProducts() {
  const store = useMarketplace();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [deleting, setDeleting] = useState<Product | null>(null);
  const products = store.products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || p.status === status || (status === "featured" && p.featured)),
  );
  return (
    <DashboardLayout owner title="Produk">
      <AdminHeading
        title="Koleksi Produk Anda."
        description="Kelola, sesuaikan, dan terbitkan produk digital Anda."
        action
      />
      <div className="market-toolbar">
        <div className="search-field">
          <Search />
          <input
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            aria-label="Cari produk admin"
          />
        </div>
        <select
          className="form-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status produk"
        >
          <option value="all">Semua produk</option>
          <option value="published">Tayang</option>
          <option value="draft">Draf</option>
          <option value="featured">Unggulan</option>
        </select>
      </div>
      <div className="panel p-0">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Framework</th>
                <th>Status Build</th>
                <th>Demo</th>
                <th>URL Pratinjau</th>
                <th>Deployment Terakhir</th>
                <th>Status</th>
                <th>Unggulan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <img src={p.image} alt="" />
                      <div>
                        {p.name}
                        <p>
                          v{p.version} · {p.updated}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{p.category}</td>
                  <td>{money(p.price)}</td>
                  <ProjectCells product={p} />
                  <td>
                    <span
                      className={`status ${p.status === "published" ? "status-positive" : "status-pending"}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={p.featured}
                      aria-label={`Tandai ${p.name} sebagai unggulan`}
                      onChange={() => {
                        store.saveProduct({ ...p, featured: !p.featured });
                        toast.success("Status unggulan diperbarui");
                      }}
                    />
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          to="/admin/products/$id/edit"
                          params={{ id: p.id }}
                          aria-label={`Edit ${p.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${p.status === "published" ? "Tarik dari etalase" : "Terbitkan"} ${p.name}`}
                        title={p.status === "published" ? "Tarik dari etalase" : "Terbitkan"}
                        onClick={() => {
                          if (p.status !== "published") {
                            const issues = publishReadiness(p);
                            if (issues.length) {
                              toast.error(issues[0]);
                              return;
                            }
                          }
                          store.saveProduct({
                            ...p,
                            status: p.status === "published" ? "draft" : "published",
                          });
                          toast.success("Status publikasi produk diperbarui");
                        }}
                      >
                        {p.status === "published" ? <Eye /> : <EyeOff />}
                      </Button>
                      <ProjectActions product={p} />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus ${p.name}`}
                        title="Hapus"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <div className="empty-state m-5">
            <Package />
            <h2>Tidak ada produk ditemukan.</h2>
            <p>Coba kata kunci lain atau tambahkan produk baru pertama Anda.</p>
            <Button asChild>
              <Link to="/admin/products/new">Tambah produk</Link>
            </Button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {deleting && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleting(null)}
          >
            <motion.div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-title"
              initial={{ y: 15, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 id="delete-title">Hapus {deleting.name}?</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup dialog"
                  onClick={() => setDeleting(null)}
                >
                  <X />
                </Button>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                Tindakan ini akan menghapus produk dari koleksi etalase dan keranjang pelanggan. Riwayat pesanan demo yang sudah tercatat akan tetap dipertahankan.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleting(null)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    store.deleteProduct(deleting.id);
                    setDeleting(null);
                    toast.success("Produk berhasil dihapus");
                  }}
                >
                  Hapus produk
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
export function OrdersTable({ orders }: { orders: Order[] }) {
  const { products } = useMarketplace();
  const [selected, setSelected] = useState<Order | null>(null);
  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No. Pesanan</th>
              <th>Pelanggan</th>
              <th>Produk</th>
              <th>Total Biaya</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-[11px]">{o.id}</td>
                <td>
                  {o.customer.name}
                  <p className="mt-1 text-[10px] text-muted-foreground">{o.customer.email}</p>
                </td>
                <td>
                  {o.items
                    .map(
                      (i) => products.find((p) => p.id === i.productId)?.name || "Produk diarsipkan",
                    )
                    .join(", ")}
                </td>
                <td>{money(o.total)}</td>
                <td>
                  <span
                    className={`status ${o.status === "Pending" ? "status-pending" : "status-positive"}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="text-muted-foreground">{o.date}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Lihat pesanan ${o.id}`}
                    onClick={() => setSelected(o)}
                  >
                    <ArrowUpRight />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Tidak ada pesanan yang sesuai.
          </p>
        )}
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Rincian pesanan"
              initial={{ x: 25 }}
              animate={{ x: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Pesanan {selected.id}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup rincian pesanan"
                  onClick={() => setSelected(null)}
                >
                  <X />
                </Button>
              </div>
              <span
                className={`status ${selected.status === "Pending" ? "status-pending" : "status-positive"}`}
              >
                {selected.status}
              </span>
              <div className="summary-row">
                <span>Pelanggan</span>
                <span>{selected.customer.name}</span>
              </div>
              <div className="summary-row">
                <span>Email</span>
                <span className="break-all">{selected.customer.email}</span>
              </div>
              <div className="summary-row">
                <span>WhatsApp</span>
                <span>{selected.customer.whatsapp || "Tidak tersedia"}</span>
              </div>
              <div className="summary-row">
                <span>Metode</span>
                <span>{selected.paymentMethod}</span>
              </div>
              <div className="summary-row">
                <span>Tanggal</span>
                <span>{selected.date}</span>
              </div>
              {selected.items.map((i, n) => (
                <div className="summary-row" key={n}>
                  <span>
                    {products.find((p) => p.id === i.productId)?.name || "Produk diarsipkan"}
                  </span>
                  <span>{licenseNames[i.license]}</span>
                </div>
              ))}
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{money(selected.total)}</strong>
              </div>
              <div className="notice mt-5">
                <Info />
                Pesanan simulasi. Pembayaran dan lisensi belum diverifikasi secara nyata.
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
export function AdminOrders() {
  const { orders } = useMarketplace();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  return (
    <DashboardLayout owner title="Pesanan">
      <AdminHeading
        title="Daftar Pesanan & Transaksi"
        description="Ringkasan riwayat transaksi pelanggan, status pembayaran, dan invoice resmi."
      />
      <div className="market-toolbar">
        <div className="search-field">
          <Search />
          <input
            className="form-input"
            aria-label="Cari pesanan"
            placeholder="Cari pesanan atau pelanggan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          aria-label="Filter pembayaran pesanan"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Semua Pembayaran</option>
          <option value="Paid">Lunas</option>
          <option value="Pending">Menunggu Pembayaran</option>
        </select>
      </div>
      <div className="panel p-0">
        <OrdersTable
          orders={orders.filter(
            (o) =>
              (status === "all" || o.status === status) &&
              `${o.id} ${o.customer.name} ${o.customer.email}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )}
        />
      </div>
    </DashboardLayout>
  );
}
export function AdminCustomers() {
  const { orders } = useMarketplace();
  const [query, setQuery] = useState(""),
    [customer, setCustomer] = useState<string | null>(null);
  const customers = Array.from(
    new Map([...seedCustomers, ...orders.map((o) => o.customer)].map((c) => [c.email, c])).values(),
  );
  return (
    <DashboardLayout owner title="Pelanggan">
      <AdminHeading
        title="Daftar Pelanggan"
        description="Kelola akun pelanggan, riwayat transaksi, dan status pesanan aktif."
      />
      <div className="search-field mb-6">
        <Search />
        <input
          className="form-input"
          placeholder="Cari pelanggan..."
          aria-label="Cari pelanggan"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="panel p-0">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Pesanan</th>
                <th>Total Belanja</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers
                .filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()))
                .map((c) => {
                  const history = orders.filter((o) => o.customer.email === c.email);
                  return (
                    <tr key={c.email}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs text-primary">
                            {c.name
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            {c.name}
                            <p className="mt-1 text-[10px] text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{history.length}</td>
                      <td>
                        {money(
                          history
                            .filter((o) => o.status !== "Pending")
                            .reduce((s, o) => s + o.total, 0),
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${c.status === "Active" ? "status-positive" : ""}`}
                        >
                          {c.status === "Active" ? "Aktif" : c.status}
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCustomer(customer === c.email ? null : c.email)}
                        >
                          Riwayat transaksi
                          <ArrowUpRight />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!customers.some((c) =>
          `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()),
        ) && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Tidak ada pelanggan yang sesuai dengan pencarian Anda.
          </p>
        )}
      </div>
      {customer && (
        <div className="panel mt-6">
          <div className="flex items-center justify-between">
            <h2>Riwayat transaksi</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tutup riwayat transaksi"
              onClick={() => setCustomer(null)}
            >
              <X />
            </Button>
          </div>
          <OrdersTable orders={orders.filter((o) => o.customer.email === customer)} />
        </div>
      )}
    </DashboardLayout>
  );
}
export function AdminAnalytics() {
  const [period, setPeriod] = useState("6 months");
  return (
    <DashboardLayout owner title="Analitik">
      <div className="app-heading">
        <AdminHeading
          title="Analisis Pasar & Performa."
          description="Pelajari data ketertarikan pengunjung dan tingkat konversi produk Anda."
        />
        <select
          className="form-input"
          aria-label="Rentang waktu analitik"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="30 days">30 hari terakhir</option>
          <option value="90 days">90 hari terakhir</option>
          <option value="6 months">6 bulan terakhir</option>
        </select>
      </div>
      <div className="metric-grid">
        {[
          [
            "Tayangan produk",
            period === "30 days" ? "10.300" : period === "90 days" ? "15.000" : "22.800",
          ],
          [
            "Interaksi live demo",
            period === "30 days" ? "1.248" : period === "90 days" ? "3.724" : "6.420",
          ],
          ["Tingkat konversi", "4.8%"],
          ["Rata-rata pesanan", "Rp 1.498.000"],
        ].map(([label, value]) => (
          <div className="panel metric" key={label}>
            <span className="metric-label">
              {label}
              <TrendingUp />
            </span>
            <strong>{value}</strong>
            <small>Metrik Penjualan & Konversi</small>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RevenueChart period={period} />
        <RevenueChart analytics period={period} />
      </div>
      <div className="panel mt-6">
        <h2>Performa Produk Teratas</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kunjungan Halaman</th>
                <th>Kunjungan Demo</th>
                <th>Konversi</th>
              </tr>
            </thead>
            <tbody>
              {["FinanceFlow", "RetailPOS", "TaskPilot", "EventSphere"].map((p, i) => (
                <tr key={p}>
                  <td>{p}</td>
                  <td>{(6200 - i * 1100).toLocaleString()}</td>
                  <td>{1420 - i * 200}</td>
                  <td>
                    <span className="text-success">{(5.8 - i * 0.6).toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
export function AdminSettings() {
  const store = useMarketplace();
  const [tab, setTab] = useState("Profil Toko");
  return (
    <DashboardLayout owner title="Pengaturan">
      <AdminHeading
        title="Pengaturan Toko & Preferensi"
        description="Kelola identitas etalase produk dan pengaturan akun admin."
      />
      <div className="chips">
        {["Profil Toko", "Brand & Media Sosial", "Konfigurasi Pembayaran", "Preferensi"].map((t) => (
          <Button
            variant="ghost"
            className={`chip ${tab === t ? "chip-active" : ""}`}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <form
        key={tab}
        className="panel max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          store.saveSettings({
            ...store.settings,
            ...Object.fromEntries(Array.from(data.entries()).map(([k, v]) => [k, String(v)])),
            ...(tab === "Preferensi" ? { notifications: data.has("notifications") ? "on" : "off" } : {}),
          });
          toast.success("Preferensi pengaturan dikirim untuk disimpan");
        }}
      >
        <h2>{tab}</h2>
        {tab === "Profil Toko" ? (
          <div className="form-stack">
            {[
              ["storeName", "Nama Toko / Etalase"],
              ["tagline", "Tagline / Slogan"],
              ["email", "Email Bantuan & Dukungan"],
            ].map(([name = "", label]) => (
              <div className="field" key={name}>
                <label htmlFor={name}>{label}</label>
                <input
                  id={name}
                  name={name}
                  className="form-input"
                  defaultValue={store.settings[name]}
                />
              </div>
            ))}
          </div>
        ) : tab === "Brand & Media Sosial" ? (
          <div className="form-stack">
            <div className="notice">
              <Info />
              Identitas geometris LABDITS sudah terintegrasi. Tautan media sosial berikut adalah preferensi etalase, bukan akun OAuth yang terhubung langsung.
            </div>
            {["instagram", "github", "website"].map((name) => (
              <div className="field" key={name}>
                <label htmlFor={name}>URL {name.toUpperCase()}</label>
                <input
                  id={name}
                  name={name}
                  type="url"
                  className="form-input"
                  defaultValue={store.settings[name]}
                  placeholder="https://..."
                />
              </div>
            ))}
          </div>
        ) : tab === "Konfigurasi Pembayaran" ? (
          <div className="form-stack">
            <div className="notice">
              <Info />
              Pilihan ini hanya preferensi tampilan. Integrasi pembayaran nyata memerlukan backend terverifikasi; alur saat ini dapat menggunakan transaksi simulasi. Jangan masukkan kredensial rahasia di frontend publik.
            </div>
            <div className="field">
              <label>Penyedia Pembayaran Terpilih</label>
              <select
                className="form-input"
                name="provider"
                defaultValue={store.settings['provider'] || "Belum dikonfigurasi"}
              >
                <option>Belum dikonfigurasi</option>
                <option>Pakasir — memerlukan backend</option>
                <option>Midtrans — integrasi mendatang</option>
                <option>Xendit — integrasi mendatang</option>
              </select>
            </div>
            <div className="field">
              <label>Mode Transaksi</label>
              <input className="form-input" disabled value="Simulasi; verifikasi pembayaran server belum tersedia" />
            </div>
          </div>
        ) : (
          <div className="form-stack">
            <label className="filter-choice">
              <input
                type="checkbox"
                name="notifications"
                defaultChecked={store.settings['notifications'] !== "off"}
              />
              Notifikasi pesanan baru (Email / Dashboard)
            </label>
            <div className="field">
              <label>Mata Uang Etalase</label>
              <input className="form-input" value="Rupiah Indonesia (Rp / IDR)" disabled />
            </div>
            <div className="field">
              <label>Zona Waktu</label>
              <select
                className="form-input"
                name="timezone"
                defaultValue={store.settings['timezone'] || "Asia/Jakarta"}
              >
                <option>Asia/Jakarta (WIB)</option>
                <option>Asia/Makassar (WITA)</option>
                <option>Asia/Jayapura (WIT)</option>
              </select>
            </div>
          </div>
        )}
        <Button className="mt-6" type="submit">
          Simpan pengaturan
        </Button>
      </form>
    </DashboardLayout>
  );
}
