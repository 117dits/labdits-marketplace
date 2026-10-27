import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Package, Download, ShoppingBag, ArrowUpRight, ShieldCheck, Mail, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useMarketplace } from '@/hooks/use-marketplace';
import { OrdersTable } from '@/components/admin/admin-pages';
import { money, licenseNames } from '@/data/products';
import { mockService } from '@/services/mock-service';
import { catalogConfigured } from '@/services/catalog-service';
import { supabase } from '@/integrations/supabase/client';
function SupabaseLogin(){
  const navigate=useNavigate();
  const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'register') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: fullName || email.split('@')[0] }
          }
        });
        if (error) throw error;
        toast.success('Pendaftaran berhasil! Silakan masuk ke akun Anda.');
        setMode('login');
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Berhasil masuk.');
        let isAdmin = false;
        if (authData.user) {
          const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', authData.user.id);
          isAdmin = Boolean(roles?.some(r => r.role === 'admin'));
        }
        void navigate({ to: isAdmin ? '/admin' : '/account' });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan autentikasi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="site-container py-16">
      <div className="mx-auto max-w-md panel">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold">{mode === 'login' ? 'Masuk ke LABDITS' : 'Daftar Akun Baru'}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === 'login' ? 'Akses produk, lisensi, dan unduhan Anda.' : 'Buat akun pelanggan untuk membeli template dan produk digital.'}
            </p>
          </div>
        </div>

        <div className="mb-6 flex rounded-lg bg-secondary/50 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('login')}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${mode === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('register')}
          >
            Registrasi
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="auth-name">Nama Lengkap</label>
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                className="form-input"
                placeholder="cth. Aditya Pratama"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Alamat Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              className="form-input"
              placeholder="nama@domain.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Kata Sandi</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="form-input"
              placeholder="••••••••"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={busy} className="mt-2 w-full btn-hover-lift">
            {busy ? (mode === 'login' ? 'Memproses masuk…' : 'Mendaftarkan…') : (mode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun')}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>Belum punya akun? <button type="button" onClick={() => setMode('register')} className="text-primary hover:underline font-medium">Daftar sekarang</button></>
            ) : (
              <>Sudah memiliki akun? <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">Masuk di sini</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
export function Login(){return <SupabaseLogin/>}
export function AccountPage({view='overview'}:{view?:'overview'|'orders'|'downloads'|'settings'}){
  const store=useMarketplace();
  const own=store.orders.filter(o=>o.customer.email===store.session?.email);
  const paid=own.filter(o=>o.status!=='Pending'&&o.status!=='Cancelled');
  const items=paid.flatMap(o=>o.items.map(i=>({...i,orderId:o.id})));
  const [name,setName]=useState(store.session?.name||''),[email,setEmail]=useState(store.session?.email||'');
  const titles={overview:'Area Pelanggan Anda.',orders:'Riwayat Pesanan.',downloads:'Unduhan Source Code & Lisensi.',settings:'Pengaturan Akun.'};
  return <DashboardLayout title={{overview:'Ringkasan',orders:'Pesanan',downloads:'Unduhan',settings:'Pengaturan'}[view]}>
    <div className="app-heading">
      <div>
        <div className="eyebrow mb-4">LABDITS / AKUN SAYA</div>
        <h1>{titles[view]}</h1>
        <p>{view==='overview'?`Selamat datang kembali, ${store.session?.name||'Pelanggan'}.`:'Kelola lisensi, riwayat pesanan, dan unduhan source code Anda di sini.'}</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to="/products">Jelajahi Produk<ArrowUpRight/></Link>
      </Button>
    </div>
    {view==='overview'&&<>
      <div className="metric-grid">
        {[['Aplikasi Anda',items.length],['Total Pesanan',own.length],['Total Transaksi',money(paid.reduce((s,o)=>s+o.total,0))],['Bantuan Teknis','Aktif']].map(([label,value])=>
          <div className="panel metric" key={label}>
            <span className="metric-label">{label}</span>
            <strong>{value}</strong>
            <small>Status Akun Resmi</small>
          </div>
        )}
      </div>
      <div className="panel mb-6">
        <h2>Pesanan Terbaru</h2>
        <OrdersTable orders={own.slice(0,3)}/>
      </div>
    </>}
    {view==='orders'&&<div className="panel">
      <h2>Riwayat Seluruh Pesanan</h2>
      <OrdersTable orders={own}/>
    </div>}
    {(view==='downloads'||view==='overview')&&<>
      <div className="section-heading mt-8">
        <div><h2>Source Code & Produk Anda</h2></div>
        {view==='overview'&&<Button variant="link" asChild><Link to="/account/downloads">Semua unduhan<ArrowUpRight/></Link></Button>}
      </div>
      {!items.length?<div className="empty-state">
        <Package/>
        <h2>Belum ada source code yang dibeli.</h2>
        <p>Selesaikan pembelian lisensi untuk membuka akses unduhan source code di sini.</p>
        <Button asChild><Link to="/products">Cari Produk Sekarang</Link></Button>
      </div>:<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {items.map((item,index)=>{
          const p=store.products.find(p=>p.id===item.productId);
          return p?<div className="panel" key={index}>
            <div className="table-product mb-5">
              <img src={p.image} alt={p.name}/>
              <div>
                <h3>{p.name}</h3>
                <p>{p.subtitle}</p>
              </div>
            </div>
            <div className="summary-row"><span>Lisensi</span><span>{licenseNames[item.license]}</span></div>
            <div className="summary-row"><span>Kode Invoice</span><span className="font-mono text-[10px]">INV-{item.orderId}-{p.id}</span></div>
            <div className="notice mb-4"><Info/>Akses unduhan source code penuh dan panduan instalasi resmi.</div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={()=>{mockService.downloadExample(p.name);toast.success('Source code / panduan berhasil diunduh')}}>
                <Download/>Unduh Source Code
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/support">Hubungi Dukungan<Mail/></Link>
              </Button>
            </div>
          </div>:null;
        })}
      </div>}
    </>}
    {view==='settings'&&<form className="panel max-w-xl form-stack" onSubmit={async e=>{e.preventDefault();if(!store.session)return;try { if(catalogConfigured()){const {error}=await supabase.auth.updateUser({data:{name:name||store.session.name}});if(error)throw error;}else store.setSession({...store.session,name:name||store.session.name,email:email||store.session.email});toast.success('Pengaturan profil berhasil disimpan');}catch(error){toast.error(error instanceof Error?error.message:'Profil gagal disimpan');}}}>
      <h2>Informasi Profil</h2>
      <div className="field">
        <label htmlFor="account-name">Nama Lengkap</label>
        <input id="account-name" required className="form-input" value={name||store.session?.name||''} onChange={e=>setName(e.target.value)}/>
      </div>
      <div className="field">
        <label htmlFor="account-email">Email Terdaftar</label>
        <input id="account-email" type="email" required readOnly={catalogConfigured()} className="form-input" value={email||store.session?.email||''} onChange={e=>setEmail(e.target.value)}/>
        {catalogConfigured()&&<p className="text-xs text-muted-foreground">Untuk mengubah email akun, gunakan alur verifikasi email Supabase; formulir ini hanya mengubah nama profil.</p>}
      </div>
      <Button type="submit">Simpan Perubahan</Button>
    </form>}
  </DashboardLayout>;
}
