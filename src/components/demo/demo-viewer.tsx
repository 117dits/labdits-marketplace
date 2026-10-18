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
import { isDeploymentLive, type Product } from "@/types";
import { currentStatus, statusLabel } from "@/components/admin/project-uploader";
const VIEWPORTS: Record<string, string> = {
  Desktop: "1440px",
  Laptop: "1024px",
  Tablet: "768px",
  Mobile: "390px",
};
export function DemoViewer({ slug }: { slug: string }) {
  const { products, addToCart, session } = useMarketplace();
  const p = products.find(
    (p) => p.slug === slug && (p.status === "published" || session?.role === "owner"),
  );
  const [device, setDevice] = useState("Desktop"),
    [refresh, setRefresh] = useState(0),
    [external, setExternal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!p)
    return (
      <div className="site-container py-20">
        <h1>Demo unavailable</h1>
        <Button asChild className="mt-5">
          <Link to="/products">Back to products</Link>
        </Button>
      </div>
    );
  const dep = p.project?.deployment;
  const live = isDeploymentLive(dep);
  const externalUrl = p.demoUrl && /^https:\/\//.test(p.demoUrl) ? p.demoUrl : undefined;
  const hasProjectSource = Boolean(p.project || (p.files?.length && !externalUrl));
  const ownerNeedsDeployment = session?.role === "owner" && !hasProjectSource && !externalUrl;
  const url = p.project ? (live ? dep?.previewUrl : undefined) : externalUrl;
  const blocked = external || (live && dep.embeddable === false);
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
            title="Refresh preview"
            aria-label="Refresh preview"
            onClick={() => {
              setRefresh((x) => x + 1);
              toast.success("Preview refreshed");
            }}
          >
            <RotateCw />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Fullscreen preview"
            aria-label="Fullscreen preview"
            onClick={() => {
              if (ref.current?.requestFullscreen)
                ref.current
                  .requestFullscreen()
                  .catch(() => toast.info("Fullscreen is not supported by this browser."));
              else toast.info("Fullscreen is not supported by this browser.");
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
                title="Open external demo"
                aria-label="Open external demo"
              >
                <ExternalLink />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/products/$slug"
              params={{ slug: p.slug }}
              title="Back to product"
              aria-label="Back to product"
            >
              <ArrowLeft />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/checkout" onClick={() => addToCart(p.id)}>
              Buy project
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
                {p.project ? "Deployed preview" : "External embedded preview"} ·{" "}
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
                Preview: <strong>Bundled interactive demo</strong>
                {(hasProjectSource || ownerNeedsDeployment) && (
                  <>
                    {" "}
                    · Uploaded build: {p.project ? statusLabel[currentStatus(p.project)] : "not connected"}
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
              Preview not loading?
            </Button>
          )}
        </div>
        {blocked && url && (
          <div className="notice mx-auto mb-5 max-w-6xl">
            <Info />
            <span>
              This application blocks embedding (X-Frame-Options or CSP frame-ancestors).{" "}
              <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                Open Live Demo
              </a>{" "}
              in a new tab.
            </span>
          </div>
        )}
        <div
          className={`demo-frame ${device === "Mobile" ? "demo-mobile" : ""}`}
          style={{ width, maxWidth: "100%" }}
        >
          {url && (hasProjectSource || p.demoMode !== "mock") ? (
            <iframe
              key={refresh}
              src={url}
              title={`${p.name} live demo`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={() => setExternal(true)}
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : (
            <MockApplication key={`${p.id}-${refresh}`} product={p} />
          )}
        </div>
      </div>
    </div>
  );
}
export function MockApplication({ product: p }: { product: Product }) {
  const [tab, setTab] = useState("Overview"),
    [query, setQuery] = useState(""),
    [tasks, setTasks] = useState([
      { name: "Design the new homepage", status: 0 },
      { name: "Build reusable components", status: 1 },
      { name: "Review brand direction", status: 2 },
      { name: "Prepare launch checklist", status: 0 },
    ]),
    [order, setOrder] = useState<string[]>([]),
    [period, setPeriod] = useState("This month");
  const addTask = () => {
    const name = window.prompt("Task name");
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
          onClick={() => toast.info("You are exploring the bundled interactive preview.")}
        >
          Preview workspace
        </Button>
      </div>
      <div className="chips">
        {["Overview", isPOS ? "Point of Sale" : isTask ? "Board" : "Transactions", "Reports"].map(
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
        <h1>{isPOS ? "Point of Sale" : isTask ? "Website redesign" : tab}</h1>
        {isTask ? (
          <Button onClick={addTask} size="sm">
            <Plus />
            New task
          </Button>
        ) : (
          <select
            className="form-input"
            aria-label="Demo date range"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>This month</option>
            <option>Last month</option>
            <option>This year</option>
          </select>
        )}
      </div>
      {isTask ? (
        <div className="mock-kanban">
          {["To do", "In progress", "Done"].map((label, i) => (
            <div className="mock-kanban-column" key={label}>
              <h3>
                {label} · {tasks.filter((t) => t.status === i).length}
              </h3>
              {tasks
                .filter((t) => t.status === i)
                .map((t) => (
                  <div className="mock-task" key={t.name}>
                    <p>{t.name}</p>
                    <span className="status mt-3">{i === 2 ? "Complete" : "Medium priority"}</span>
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
                      {i === 2 ? "Reopen" : "Move to next"}
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
              <h2>Current order</h2>
              {order.length ? (
                order.map((o, i) => (
                  <div className="summary-row" key={i}>
                    <span>{o}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOrder((x) => x.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Select an item to start an order.</p>
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
                  toast.success("Demo sale completed. No payment collected.");
                }}
              >
                Complete demo sale
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="metric-grid">
            {[
              ["Total balance", period === "Last month" ? "Rp 98.420.000" : "Rp 124.850.000"],
              ["Total income", period === "This year" ? "Rp 342.400.000" : "Rp 32.400.000"],
              ["Total expenses", "Rp 18.250.000"],
            ].map(([label, value]) => (
              <div className="panel metric" key={label}>
                <span className="metric-label">{label}</span>
                <strong>{value}</strong>
                <small>+12.8% from last period</small>
              </div>
            ))}
          </div>
          {tab !== "Transactions" && (
            <div className="panel">
              <h2>{tab === "Reports" ? "Revenue report" : "Revenue overview"}</h2>
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
              <h2>Recent transactions</h2>
              <div className="search-field">
                <Search />
                <input
                  className="form-input"
                  aria-label="Search demo transactions"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {["Design subscription", "Client payment", "Office supplies", "Project invoice"]
                    .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                    .map((name, i) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{i % 2 ? "Income" : "Business"}</td>
                        <td>{money(250000 + i * 1750000)}</td>
                        <td>
                          <span className="status status-positive">Completed</span>
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
        Bundled interactive preview. Changes stay in this session and reset when refreshed.
      </div>
    </div>
  );
}
