import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Code2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/views/marketplace';
import { CategoryGrid, HowSteps, WhyGrid } from '@/components/views/home';

export function ContentPage({page}:{page:string}){
  const titles:Record<string,string>={
    categories:'Temukan Titik Awal Anda.',
    'how-it-works':'Dari Penjelajahan Hingga Peluncuran.',
    about:'Karya Mandiri. Produk Digital Berkualitas Tinggi.',
    contact:'Mari Bangun Sesuatu yang Luar Biasa.',
    support:'Dukungan Teknis Pengembang Berpengalaman.',
    licenses:'Pilihan Lisensi yang Tepat Untuk Bisnis Anda.'
  };
  return (
    <div className="site-container">
      <PageHeading
        title={titles[page]||'LABDITS'}
        eyebrow={`LABDITS / ${page.replace(/-/g, ' ').toUpperCase()}`}
        description={page==='about'?'LABDITS adalah studio produk digital mandiri yang menggabungkan desain berkelas dan rekayasa fullstack profesional.':'Produk premium. Transaksi transparan. Pengalaman terbaik dari awal hingga peluncuran.'}
      />
      <div className="page-body">
        {page==='categories'?<CategoryGrid/>:page==='how-it-works'?<>
          <HowSteps/>
          <div className="section"><WhyGrid/></div>
        </>:page==='about'?<>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-5">Desain dengan Rasa. Kode dengan Presisi.</div>
              <h2 className="text-3xl leading-tight">Bukan Sekadar Template.<br/><span className="text-primary">Fondasi Terbaik Untuk Sukses.</span></h2>
              <p className="mt-6 text-sm leading-8 text-muted-foreground">Pengalaman digital yang hebat terwujud saat estetika desain dan performa rekayasa bersatu. LABDITS menghadirkan produk yang memikat mata, mudah digunakan, dan memberikan fondasi arsitektur bersih yang siap Anda kembangkan.</p>
              <p className="mt-4 text-sm leading-8 text-muted-foreground">Setiap produk dirancang berdasarkan alur kerja nyata, antarmuka responsif, dan kode modular. Dari sistem kasir hingga dashboard admin keuangan, tujuannya satu: mempercepat peluncuran ide digital Anda ke pasar.</p>
              <Button asChild className="mt-7 btn-hover-lift"><Link to="/products">Jelajahi Koleksi Produk<ArrowUpRight/></Link></Button>
            </div>
            <div className="border-l border-border pl-8">
              <Code2 className="h-10 w-10 text-primary mb-4"/>
              <h3 className="text-xl font-medium">Nilai Utama LABDITS</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• <strong>Kode Bersih & Rapi</strong>: Ditulis dengan standar TypeScript dan React modern.</li>
                <li>• <strong>Desain Responsif</strong>: Tampilan optimal di HP, tablet, maupun layar monitor besar.</li>
                <li>• <strong>Sekali Bayar</strong>: Hak milik selamanya tanpa biaya langganan bulanan.</li>
                <li>• <strong>Dukungan Pengembang</strong>: Bantuan teknis langsung untuk mempermudah konfigurasi.</li>
              </ul>
            </div>
          </div>
          <div className="section"><WhyGrid/></div>
        </>:page==='licenses'?<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            ['Lisensi Personal','Untuk 1 proyek pribadi, portofolio, atau aplikasi non-komersial.','Source code frontend lengkap','Dilarang dijual kembali atau didistribusikan ulang'],
            ['Lisensi Komersial','Untuk 1 proyek komersial, bisnis SaaS berbayar, atau aplikasi pesanan klien.','Hak penggunaan komersial penuh','Dilarang mendistribusikan ulang source code mentah'],
            ['Lisensi + Kustomisasi','Lisensi komersial ditambah bantuan instalasi dan penyesuaian khusus.','Panduan instalasi & setup langsung','Kustomisasi awal sesuai kesepakatan']
          ].map(([title,...lines])=><section className="panel" key={title}>
            <h2>{title}</h2>
            {lines.map(l=><p className="my-4 text-sm leading-7 text-muted-foreground" key={l}>{l}</p>)}
            <Button asChild variant="outline" className="mt-4 btn-hover-lift"><Link to="/products">Jelajahi Produk<ArrowUpRight/></Link></Button>
          </section>)}
        </div>:<div className="two-column">
          <form className="panel form-stack" onSubmit={e=>{e.preventDefault();toast.success('Pesan Anda berhasil terkirim! Tim kami akan segera merespons.');(e.currentTarget as HTMLFormElement).reset();}}>
            <h2>{page==='support'?'Pusat Bantuan & Konsultasi':'Ceritakan Kebutuhan Proyek Anda'}</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="contact-name">Nama Lengkap</label><input id="contact-name" className="form-input" required placeholder="Nama Anda"/></div>
              <div className="field"><label htmlFor="contact-email">Alamat Email</label><input id="contact-email" type="email" className="form-input" required placeholder="email@domain.com"/></div>
            </div>
            <div className="field"><label htmlFor="contact-topic">Topik Keperluan</label><select id="contact-topic" className="form-input"><option>Proyek Aplikasi Kustom</option><option>Pertanyaan Mengenai Produk</option><option>Bantuan Instalasi & Deployment</option><option>Ketentuan Lisensi Komersial</option></select></div>
            <div className="field"><label htmlFor="contact-message">Pesan Lengkap</label><textarea id="contact-message" className="form-input" required placeholder="Tuliskan detail kebutuhan proyek atau pertanyaan Anda di sini..."/></div>
            <Button type="submit" className="btn-hover-lift">Kirim Pesan Sekarang<Send className="ml-2 h-4 w-4"/></Button>
          </form>
          <div>
            <div className="eyebrow mb-5">Wujudkan Bersama LABDITS</div>
            <h2 className="text-2xl">Ide brilian layak mendapatkan<br/>eksekusi terbaik.</h2>
            <p className="mt-5 text-sm leading-8 text-muted-foreground">Apakah Anda butuh bantuan instalasi produk, penyesuaian fitur khusus, atau ingin mengembangkan aplikasi dari awal — konsultasikan bersama kami sekarang.</p>
            {page==='support'&&<div className="mt-8">{[
              ['Bagaimana cara memasang produk yang sudah dibeli?','Setiap paket produk menyertakan berkas dokumentasi setup lengkap (.env.example, langkah instalasi dependensi, dan perintah deploy produksi).'],
              ['Di mana saya bisa mengunduh file source code?','Setelah transaksi selesai diverifikasi, buka halaman Akun Saya > Unduhan untuk langsung mengunduh source code produk Anda.'],
              ['Apakah ada jaminan bantuan teknis?','Ya, setiap lisensi dilengkapi dengan dukungan pengembang resmi untuk membantu proses instalasi dan menjawab pertanyaan teknis Anda.']
            ].map(([q,a])=><details className="faq-item" key={q}><summary>{q}</summary><p className="mt-4 text-xs leading-7 text-muted-foreground">{a}</p></details>)}</div>}
          </div>
        </div>}
      </div>
    </div>
  );
}
