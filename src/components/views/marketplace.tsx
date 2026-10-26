import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Search, SlidersHorizontal, PackageOpen, ArrowLeft, Play, ShoppingBag, Check, ArrowUpRight, ShieldCheck, Info, Monitor, Tablet, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/products/product-card';
import { useMarketplace } from '@/hooks/use-marketplace';
import { categories, money, licenseNames, priceFor } from '@/data/products';
import type { License } from '@/types';
export function PageHeading({eyebrow,title,description}:{eyebrow?:string;title:string;description?:string}){return <div className="page-heading"><div className="eyebrow">{eyebrow||'LABDITS / THE COLLECTION'}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>}
export function Marketplace({initialCategory='',demos=false}:{initialCategory?:string | undefined;demos?:boolean | undefined}){
  const {products}=useMarketplace();
  const [search,setSearch]=useState(''),[selected,setSelected]=useState(initialCategory),[tech,setTech]=useState<string[]>([]),[max,setMax]=useState(6000000),[sort,setSort]=useState('popular'),[showFilters,setShowFilters]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{const t=setTimeout(()=>setLoading(false),450);return()=>clearTimeout(t)},[]);
  useEffect(()=>setSelected(initialCategory),[initialCategory]);
  const filtered=products.filter(p=>p.status==='published'&&(!selected||p.category===selected)&&(!demos||p.freeDemo!==false)&&p.price<=max&&(!tech.length||tech.some(t=>p.stack.includes(t)))&&`${p.name} ${p.subtitle}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:sort==='new'?b.updated.localeCompare(a.updated):b.popularity-a.popularity);
  const reset=()=>{setSelected('');setTech([]);setSearch('');setMax(6000000)};
  return <div className="site-container">
    <PageHeading title={demos?'Coba Live Demo Interaktif.':'Katalog Produk Siap Pakai.'} description="Koleksi website premium, dashboard admin, dan template profesional. Coba langsung demo sebelum membeli."/>
    <div className="page-body">
      <Button variant="outline" className="mb-5 md:hidden" onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal/>Filter Produk</Button>
      <div className="filter-layout">
        <aside className={`filters ${showFilters?'filters-open':''}`}>
          <div className="filter-section">
            <div className="mb-5 flex justify-between">
              <h3>Filter</h3>
              <Button variant="link" size="sm" onClick={reset}>Reset</Button>
            </div>
            <h3>Kategori</h3>
            <label className="filter-choice">
              <input type="radio" name="category" checked={!selected} onChange={()=>setSelected('')}/>Semua produk
            </label>
            {categories.map(c=><label className="filter-choice" key={c}>
              <input type="radio" name="category" checked={selected===c} onChange={()=>setSelected(c)}/>{c}
            </label>)}
          </div>
          <div className="filter-section">
            <h3>Batas Harga</h3>
            <input aria-label="Harga maksimal" type="range" min={0} max={6000000} step={100000} value={max} onChange={e=>setMax(Number(e.target.value))} className="w-full"/>
            <p className="mt-3 text-[10px] text-muted-foreground">Hingga {money(max)}</p>
          </div>
          <div className="filter-section">
            <h3>Teknologi</h3>
            {['React','Next.js','TypeScript','Tailwind CSS','Motion'].map(t=><label className="filter-choice" key={t}>
              <input type="checkbox" checked={tech.includes(t)} onChange={()=>setTech(x=>x.includes(t)?x.filter(v=>v!==t):[...x,t])}/>{t}
            </label>)}
          </div>
          <div className="notice"><ShieldCheck/>Sekali Pembelian.<br/>Akses Source Code Selamanya.</div>
        </aside>
        <div className="min-w-0">
          <div className="market-toolbar">
            <div className="search-field">
              <Search/>
              <input className="form-input" placeholder="Cari nama aplikasi atau website..." aria-label="Cari produk" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select aria-label="Urutkan produk" className="form-input" value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="popular">Paling Populer</option>
              <option value="new">Terbaru</option>
              <option value="low">Harga: Rendah ke Tinggi</option>
              <option value="high">Harga: Tinggi ke Rendah</option>
            </select>
          </div>
          <p className="mb-5 text-[11px] text-muted-foreground">{filtered.length} produk siap pakai tersedia {selected&&`/ ${selected}`}</p>
          {loading?<div className="product-grid market-grid">{[1,2,3,4].map(i=><div className="skeleton h-80" key={i}/>)}</div>:filtered.length?<motion.div layout className="product-grid market-grid">
            <AnimatePresence>
              {filtered.map(p=><motion.div layout key={p.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.95}} transition={{duration:.2}}>
                <ProductCard product={p}/>
              </motion.div>)}
            </AnimatePresence>
          </motion.div>:<div className="empty-state">
            <PackageOpen/>
            <h2>Belum ada produk yang cocok.</h2>
            <p>Silakan coba kata kunci pencarian lain atau reset filter Anda.</p>
            <Button onClick={reset}>Reset Filter</Button>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}
export function ProductDetail({slug}:{slug:string}){
  const store=useMarketplace();
  if (!store.hydrated) {
    return (
      <div className="site-container py-24 text-center">
        <div className="mx-auto max-w-md panel">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <h2 className="text-lg font-semibold">Memuat Detail Produk...</h2>
          <p className="mt-2 text-xs text-muted-foreground">Menyiapkan data produk dari katalog LABDITS.</p>
        </div>
      </div>
    );
  }
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const p = store.products.find((p) =>
    (p.slug.toLowerCase() === normalizedSlug || p.id.toLowerCase() === normalizedSlug || (normalizedSlug === 'camber' && (p.id === '3' || p.slug.toLowerCase() === 'demo7'))) &&
    (p.status === 'published' || store.session?.role === 'owner')
  ) || store.products.find((p) =>
    p.slug.toLowerCase() === normalizedSlug || p.id.toLowerCase() === normalizedSlug || (normalizedSlug === 'camber' && (p.id === '3' || p.slug.toLowerCase() === 'demo7'))
  );
  const [license,setLicense]=useState<License>('personal'),[image,setImage]=useState(0);
  if(!p)return <div className="site-container py-20"><div className="empty-state"><PackageOpen/><h2>Produk Tidak Ditemukan</h2><p>Produk ini mungkin sedang dalam pengembangan atau belum dipublikasikan.</p><Button asChild><Link to="/products">Jelajahi Produk Lain</Link></Button></div></div>;return <div className="site-container"><div className="pt-7"><Link to="/products" className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3"/>Kembali ke Koleksi Produk</Link></div><PageHeading eyebrow={`${p.category} / Versi ${p.version}`} title={p.name} description={p.subtitle}/><div className="page-body two-column"><div className="min-w-0"><div className="detail-gallery"><div className="browser-bar"><i className="browser-dot"/><i className="browser-dot"/><i className="browser-dot"/><span className="browser-url">{p.name.toLowerCase()}.app / {['overview','responsive','workspace'][image]}</span></div><motion.div key={image} initial={{opacity:0}} animate={{opacity:1}} className={image===1?'mx-auto w-[65%]':image===2?'mx-auto w-[85%]':''}><img src={p.image} alt={`${p.name} ${['desktop','tablet','mobile'][image]} preview`} width={1536} height={1024}/></motion.div></div><div className="detail-thumbnails">{[Monitor,Tablet,Smartphone].map((Icon,i)=><Button key={i} variant={image===i?'default':'outline'} onClick={()=>setImage(i)} aria-label={`${['Desktop','Tablet','Mobile'][i]} screenshot`}><img src={p.image} alt=""/><span className="absolute"><Icon className="text-primary"/></span></Button>)}</div><div className="detail-section"><h2>Tentang {p.name}</h2><p>{p.description}</p></div><div className="detail-section"><h2>Fitur Utama & Keunggulan</h2><div className="feature-list">{p.features.map(f=><div key={f}><Check/>{f}</div>)}</div></div><div className="detail-section"><h2>Fondasi Teknologi Modern</h2><div className="stack-tags">{p.stack.map(s=><span key={s}>{s}</span>)}</div><div className="mt-6 flex flex-wrap gap-5 text-xs text-muted-foreground"><span>Versi {p.version}</span><span>Pembaruan {p.updated}</span><span>Desktop • Tablet • Mobile</span></div></div><div className="detail-section"><h2>Persyaratan Sistem & Instalasi</h2><p>Membutuhkan Node.js 20+, npm atau Bun, dan text editor (VS Code dll). Paket sudah dilengkapi panduan instalasi langkah demi langkah serta contoh konfigurasi environment (.env.example). Siap dideploy ke Vercel, Netlify, atau VPS mandiri.</p></div><div className="detail-section"><h2>Pertanyaan yang Sering Diajukan (FAQ)</h2>{[['Apa saja yang didapatkan dalam paket source code?','Anda mendapatkan source code lengkap, komponen UI siap pakai, aset gambar/vektor, file skema database (jika ada), serta panduan instalasi lengkap.'],['Apakah bisa digunakan untuk proyek klien?','Bisa. Pilih Lisensi Komersial untuk proyek komersial atau implementasi klien. Dilarang mendistribusikan ulang atau menjual kembali source code mentah.'],['Apakah menyediakan bantuan instalasi atau kustomisasi?','Ya. Paket Lisensi Lengkap + Instalasi mencakup bantuan instalasi server/hosting dan kustomisasi branding sesuai kesepakatan.'],['Bagaimana proses pembayaran dan pengiriman file?','Pembayaran diproses otomatis melalui QRIS / Virtual Account Pakasir. Setelah pembayaran berhasil, akses unduhan source code langsung aktif di halaman Akun Anda.']].map(([q,a])=><details className="faq-item" key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div><aside className="panel lg:sticky lg:top-24"><div className="eyebrow mb-4">Mulai Proyek Anda</div><h2>Pilihan Lisensi</h2>{(Object.keys(licenseNames) as License[]).map(l=><label className={`license-option ${license===l?'license-selected':''}`} key={l}><span className="flex items-center gap-2"><input type="radio" name="license" checked={license===l} onChange={()=>setLicense(l)}/>{licenseNames[l]}</span><strong>{money(priceFor(p,l))}</strong></label>)}<p className="my-5 text-xs leading-6 text-muted-foreground">{license==='personal'?'Untuk 1 proyek pribadi atau non-komersial.':license==='commercial'?'Untuk 1 proyek komersial atau pengiriman klien bisnis.':'Lisensi komersial penuh ditambah bantuan instalasi dan kustomisasi.'}</p><div className="form-stack"><Button asChild size="lg" className="btn-hover-lift"><Link to="/checkout" onClick={()=>store.addToCart(p.id,license)}>Beli Sekarang<ArrowUpRight/></Link></Button><Button variant="outline" className="btn-hover-lift" onClick={()=>store.addToCart(p.id,license)}><ShoppingBag/>Tambah ke Keranjang</Button><Button variant="secondary" asChild className="btn-hover-lift"><Link to="/$productSlug" params={{productSlug:p.slug}}><Play/>Coba Live Demo</Link></Button></div><div className="detail-section"><h2 className="text-sm">Termasuk dalam paket</h2><div className="flex flex-col gap-3 text-xs text-muted-foreground">{['Source code lengkap 100%','Dokumentasi & panduan instalasi','Tata letak responsif semua perangkat','Dukungan teknis pengembang resmi'].map(s=><div key={s} className="flex items-center gap-2"><Check className="h-3 w-3 text-success"/>{s}</div>)}</div></div><Button variant="link" asChild className="mt-3 w-full"><Link to="/contact">Konsultasi dengan Pengembang<ArrowUpRight/></Link></Button></aside></div><section className="section"><div className="section-heading"><div><div className="eyebrow">Eksplorasi Lainnya</div><h2>Rekomendasi Produk Serupa</h2></div></div><div className="product-grid">{store.products.filter(x=>x.id!==p.id&&x.status==='published').slice(0,3).map(x=><ProductCard key={x.id} product={x}/>)}</div></section></div>}
