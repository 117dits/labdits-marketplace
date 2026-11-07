import dash1 from '@/assets/dashboards/dash1_fernly.jpg';
import dash2 from '@/assets/dashboards/dash2_wharf.jpg';
import dash3 from '@/assets/dashboards/dash3_ledge.jpg';
import dash4 from '@/assets/dashboards/dash4_coffer.jpg';
import dash5 from '@/assets/dashboards/dash5_corbel.jpg';
import dash6 from '@/assets/dashboards/dash6_prism.jpg';
import dash7 from '@/assets/dashboards/dash7_camber.jpg';
import dash8 from '@/assets/dashboards/dash8_cadra.jpg';
import dash9 from '@/assets/dashboards/dash9_accord.jpg';
import dash10 from '@/assets/dashboards/dash10_murmura.jpg';
import dash11 from '@/assets/dashboards/dash11_kofra.jpg';
import dash12 from '@/assets/dashboards/dash12_kinby.jpg';
import dash13 from '@/assets/dashboards/dash13_vessa.jpg';
import dash14 from '@/assets/dashboards/dash14_ivora.jpg';
import dash15 from '@/assets/dashboards/dash15_sunrow.jpg';
import dash16 from '@/assets/dashboards/dash16_ambrel.jpg';
import dash17 from '@/assets/dashboards/dash17_halvo.jpg';
import dash18 from '@/assets/dashboards/dash18_nestra.jpg';
import type { Product, Order, Customer } from '@/types';
export const categories = [
  'Dashboard Admin',
  'Website Bisnis',
  'Sistem POS & Kasir',
  'Aplikasi SaaS',
  'E-Commerce',
  'Landing Page',
  'Aplikasi Kustom'
];
export const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
export const licenseNames = { personal: 'Lisensi Personal', commercial: 'Lisensi Komersial', installation: 'Lisensi Lengkap + Instalasi & Kustomisasi' };
export const priceFor = (p: Product, license: string) => license === 'commercial' ? p.commercialPrice : license === 'installation' ? p.installationPrice : p.price;
const product = (
  id: string,
  slug: string,
  name: string,
  subtitle: string,
  category: string,
  price: number,
  image: string,
  theme: string,
  features: string[],
  stack = ['React', 'TypeScript', 'Tailwind CSS'],
  description = '',
  previewUrl = ''
): Product => ({
  id,
  slug,
  name,
  subtitle,
  category,
  price,
  image,
  previewThumbnailUrl: `/previews/dash-${id}-thumb.jpg`,
  previewVideoUrl: `/previews/dash-${id}.mp4`,
  theme,
  features,
  stack,
  description: description || `${subtitle}, dirancang profesional untuk bisnis modern. ${name} menggabungkan antarmuka interaktif yang elegan, performa tinggi, dan struktur kode yang rapi serta mudah dikembangkan. Siap digunakan dan diluncurkan langsung.`,
  commercialPrice: price * 2,
  installationPrice: price * 3,
  featured: true,
  status: 'published',
  popularity: 100 - (Number(id) * 3),
  version: '2.1.0',
  updated: '2026-10-24',
  devices: ['Desktop', 'Tablet', 'Mobile'],
  freeDemo: true,
  ...(previewUrl ? { demoUrl: previewUrl } : {})
});

export const seedProducts: Product[] = [
  product(
    '1',
    'fernly',
    'Fernly',
    'Dashboard Portofolio Investasi & Analisis Finansial',
    'Dashboard Admin',
    899000,
    dash1,
    'mint',
    ['Analisis portofolio multi-aset real-time', 'Grafik performa interaktif & historis', 'Pelacakan dividen, yield, & keuntungan modal', 'Alokasi diversifikasi aset dinamis', 'Laporan ringkasan keuangan siap unduh', 'Desain responsif mode terang & gelap'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Recharts'],
    'Fernly adalah dashboard analitik portofolio investasi dan keuangan modern. Dirancang dengan antarmuka presisi tinggi untuk memantau performa aset, arus modal, dan metrik imbal hasil secara komprehensif.',
    'https://labdits-1.vercel.app'
  ),
  product(
    '2',
    'wharf',
    'Wharf',
    'Sistem Operasi Pelabuhan & Manajemen Logistik Kontainer',
    'Aplikasi SaaS',
    1499000,
    dash2,
    'blue',
    ['Pelacakan pergerakan kontainer real-time', 'Penjadwalan sandar kapal & alokasi dermaga', 'Analitik throughput bongkar muat kargo', 'Manajemen dokumen manifest & bea cukai', 'Sistem peringatan cuaca maritim otomatis', 'Animasi interaktif berbasis GSAP'],
    ['Next.js', 'React', 'TypeScript', 'GSAP', 'Tailwind CSS'],
    'Wharf adalah sistem dashboard operasi maritim dan logistik pelabuhan tingkat lanjut. Memadukan visualisasi pergerakan kargo real-time, jadwal tambat armada, dan analitik efisiensi rantai pasok dengan animasi super halus.',
    'https://labdits-2.vercel.app'
  ),
  product(
    '3',
    'ledge',
    'Ledge',
    'Dashboard Penjualan B2B & Analisis Pendapatan',
    'Dashboard Admin',
    1299000,
    dash3,
    'violet',
    ['Pipeline transaksi penjualan B2B visual', 'Proyeksi pendapatan berbasis data historis', 'Pelacakan KPI & pencapaian kuota tim sales', 'Manajemen akun prospek & kesepakatan korporat', 'Analisis rasio konversi funnel penjualan', 'Interaksi mikro halus dengan GSAP'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Ledge menghadirkan transparansi penuh bagi tim penjualan B2B dan eksekutif bisnis. Pantau velocity transaksi, pipeline kesepakatan, dan akurasi perkiraan revenue dalam satu panel terintegrasi.',
    'https://labdits-3.vercel.app'
  ),
  product(
    '4',
    'coffer',
    'Coffer',
    'Manajemen Faktur & Arus Kas Bisnis',
    'Dashboard Admin',
    999000,
    dash4,
    'slate',
    ['Pembuatan dan pelacakan faktur instan', 'Rekonsiliasi pembayaran otomatis', 'Ringkasan arus kas masuk & keluar bulanan', 'Pemberitahuan piutang jatuh tempo otomatis', 'Laporan laba rugi & pajak sederhana', 'Transisi antarmuka fluid dengan Motion'],
    ['React', 'TypeScript', 'Motion', 'Tailwind CSS', 'Lucide'],
    'Coffer adalah platform manajemen keuangan dan penagihan faktur untuk agensi dan UMKM berkembang. Sederhanakan penerbitan invoice, kurangi keterlambatan bayar, dan pantau likuiditas kas tanpa ribet.',
    'https://labdits-4.vercel.app'
  ),
  product(
    '5',
    'corbel',
    'Corbel',
    'Platform Otomasi Pemasaran & Operasional Kampanye',
    'Aplikasi SaaS',
    1199000,
    dash5,
    'amber',
    ['Alur kerja otomasi pemasaran multi-channel', 'Pelacakan konversi & atribusi kampanye', 'Segmentasi prospek dan pelanggan otomatis', 'Penjadwalan konten pemasaran digital', 'Analitik ROI belanja iklan real-time', 'Integrasi data analitik lintas platform'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Recharts', 'Lucide'],
    'Corbel memberikan kendali penuh terhadap alur kerja pemasaran digital perusahaan. Rancang kampanye otomatis, amati atribusi konversi dari setiap saluran, dan maksimalkan ROI promosi Anda.',
    'https://labdits-5.vercel.app'
  ),
  product(
    '6',
    'prism',
    'PRISM',
    'Rantai Pasok Global & Manajemen Inventaris Cerdas',
    'Aplikasi SaaS',
    1399000,
    dash6,
    'rose',
    ['Visibilitas rantai pasok global end-to-end', 'Monitoring stok gudang multi-fasilitas', 'Prediksi kebutuhan reorder stok otomatis', 'Audit performa pengiriman vendor logistik', 'Pelacakan nomor lot, serial, dan barcode', 'Diagram alir interaktif & data visualization'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Recharts', 'Lucide'],
    'PRISM adalah solusi analitik rantai pasok dan kontrol inventaris untuk manufaktur dan distributor modern. Pantau pergerakan stok antar-gudang dan antisipasi hambatan logistik sebelum terjadi.',
    'https://labdits-6.vercel.app'
  ),
  product(
    '7',
    'camber',
    'Camber',
    'E-Commerce Suku Cadang Performa & Operasional Presisi',
    'E-Commerce',
    1599000,
    dash7,
    'zinc',
    ['Katalog suku cadang performa tinggi terstruktur', 'Selector kecocokan kendaraan (make/model/year)', 'Manajemen inventaris SKU presisi dan spesifikasi', 'Portal pesanan grosir untuk bengkel rekanan', 'Diagram teknis dan panduan instalasi produk', 'Checkout cepat dengan integrasi kurir kargo'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Lucide'],
    'Camber dirancang khusus untuk industri suku cadang otomotif dan performa tinggi. Dilengkapi sistem pencarian spesifikasi presisi, selektor kompatibilitas kendaraan, dan checkout e-commerce profesional.',
    'https://labdits-7.vercel.app'
  ),
  product(
    '8',
    'cadra',
    'Cadra',
    'Manajemen Manufaktur & Operasional Pabrik Cerdas',
    'Aplikasi SaaS',
    1499000,
    dash8,
    'sky',
    ['Monitoring lini perakitan pabrik secara langsung', 'Pelacakan Overall Equipment Effectiveness (OEE)', 'Jadwal pemeliharaan mesin preventif terprogram', 'Penerbitan & pelacakan surat perintah kerja', 'Inspeksi kontrol mutu dan pencatatan cacat', 'Analitik efisiensi energi fasilitas produksi'],
    ['Vite', 'React', 'TypeScript', 'Tailwind CSS', 'Lucide'],
    'Cadra menyatukan lantai pabrik dengan ruang kontrol manajemen. Pantau efisiensi mesin, kurangi downtime tak terencana, dan standarisasi proses quality control secara transparan.',
    'https://labdits-8.vercel.app'
  ),
  product(
    '9',
    'accord',
    'Accord',
    'Manajemen Hubungan Pelanggan & Layanan Klien',
    'Aplikasi SaaS',
    999000,
    dash9,
    'emerald',
    ['Profil klien 360 derajat dan riwayat kontak', 'Helpdesk tiket keluhan & pelacakan resolusi', 'Manajemen kontrak kerja & perpanjangan layanan', 'Pelacak kepuasan pelanggan (CSAT/NPS)', 'Otomasi tindak lanjut penawaran via notifikasi', 'Animasi transisi antarmuka elegan dengan GSAP'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Accord adalah pusat komando retensi pelanggan dan layanan purna jual. Kelola komunikasi klien, selesaikan tiket aduan lebih cepat, dan rawat hubungan bisnis jangka panjang dengan elegan.',
    'https://labdits-9.vercel.app'
  ),
  product(
    '10',
    'murmura',
    'Murmura',
    'Workspace Manajemen Multi-Akun Media Sosial',
    'Aplikasi SaaS',
    1199000,
    dash10,
    'stone',
    ['Ruang kerja tenang terpadu untuk semua akun sosial', 'Kalender penjadwalan & penerbitan konten cerdas', 'Kotak masuk interaksi pelanggan terpusat', 'Analisis engagement & pertumbuhan pengikut', 'Perpustakaan aset media dan template postingan', 'Alur kerja peninjauan & persetujuan konten tim'],
    ['React', 'TypeScript', 'Motion', 'Tailwind CSS', 'Lucide'],
    'Murmura mengembalikan ketenangan ke dalam manajemen media sosial tim kreatif. Jadwalkan konten lintas platform, tanggapi pesan audiens dalam satu inbox, dan analisis tren jangkauan tanpa stres.',
    'https://labdits-10.vercel.app'
  ),
  product(
    '11',
    'kofra',
    'Kofra',
    'Perbankan Bisnis & Pembayaran Pengusaha Mandiri',
    'Dashboard Admin',
    1399000,
    dash11,
    'amber',
    ['Rekening perbankan bisnis modern multi-dompet', 'Penerbitan kartu debit virtual & fisik instan', 'Pengiriman dana domestik & valas biaya rendah', 'Kategorisasi pengeluaran bisnis otomatis', 'Pembuatan invoice cepat dengan tautan QRIS', 'Hak akses bertingkat untuk akuntan dan staf'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Kofra diciptakan khusus untuk kebutuhan keuangan founder, kreator, dan pelaku usaha mandiri. Kelola arus modal bisnis, terbitkan kartu belanja tim, dan otomasi pelaporan pembukuan.',
    'https://labdits-11.vercel.app'
  ),
  product(
    '12',
    'kinby',
    'Kinby',
    'Solusi Keuangan Personal & Perencanaan Anggaran Pintar',
    'Dashboard Admin',
    899000,
    dash12,
    'teal',
    ['Perencanaan pos anggaran keluarga berbasis amplop', 'Sinkronisasi riwayat transaksi & mutasi bank', 'Target tabungan masa depan & dana darurat', 'Peringatan otomatis jadwal tagihan rutin', 'Visualisasi tren pengeluaran bulanan jelas', 'Desain ultra-responsif nyaman di ponsel'],
    ['Vite', 'React', 'TypeScript', 'Tailwind CSS', 'Lucide'],
    'Kinby membantu perorangan dan keluarga mengatur stabilitas finansial dengan mudah. Pantau alokasi gaji, hindari pembengkakan pos belanja, dan capai tujuan tabungan impian dengan visual yang menyenangkan.',
    'https://labdits-12.vercel.app'
  ),
  product(
    '13',
    'vessa',
    'Vessa',
    'Manajemen Stok & Pasokan Laboratorium Formulasi Kulit',
    'Website Bisnis',
    1399000,
    dash13,
    'rose',
    ['Database bahan baku aktif & ekstrak kosmetik', 'Kontrol nomor batch & pemantauan expired date', 'Pencatatan formula resep uji laboratorium', 'Pelacakan standar kepatuhan regulasi BPOM', 'Manajemen pasokan sampel dan uji stabilitas', 'Laporan ketersediaan stok kritis real-time'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Vessa adalah sistem operasi digital untuk lab kosmetik, manufaktur skincare, dan farmasi kecantikan. Lacak asal bahan baku, amankan formula rahasia produk, dan penuhi standar sertifikasi mutu.',
    'https://labdits-13.vercel.app'
  ),
  product(
    '14',
    'ivora',
    'Ivora',
    'Sistem Manajemen Praktik & Rekam Medis Klinik Gigi',
    'Aplikasi SaaS',
    1599000,
    dash14,
    'cyan',
    ['Odontogram digital interaktif untuk dokter gigi', 'Buku janji temu & jadwal operasional dokter', 'Pengingat jadwal periksa otomatis via WhatsApp', 'Rekam medis elektronik (RME) standar Kemenkes', 'Faktur perawatan klinik dan klaim asuransi', 'Manajemen inventaris obat dan alat kedokteran'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Ivora memodernisasi operasional klinik gigi keluarga dan praktek spesialis. Dari pencatatan odontogram hingga penagihan biaya tindakan, semua terintegrasi cepat dan aman.',
    'https://labdits-14.vercel.app'
  ),
  product(
    '15',
    'sunrow',
    'Sunrow',
    'ERP Konstruksi Pembangkit Surya & Sistem Baterai',
    'Website Bisnis',
    1799000,
    dash15,
    'amber',
    ['Pelacak kemajuan proyek PLTS dan kurva-S fisik', 'Manajemen kru lapangan, teknisi & subkontraktor', 'Logistik pengiriman panel surya dan inverter', 'Pencatatan inspeksi keselamatan kerja (K3/HSE)', 'Rancangan anggaran biaya (RAB) & klaim milestone', 'Metrik kapasitas daya gigawatt-hour terpasang'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Lucide'],
    'Sunrow adalah platform enterprise untuk kontraktor EPC energi terbarukan dan instalasi solar fotovoltaik. Kendalikan proyek pembangkit surya berskala utilitas hingga instalasi atap komersial.',
    'https://labdits-15.vercel.app'
  ),
  product(
    '16',
    'ambrel',
    'Ambrel',
    'Manajemen Butik Mewah, Ritel & Katalog Koleksi Terbatas',
    'E-Commerce',
    1699000,
    dash16,
    'stone',
    ['Katalog kurasi koleksi busana & aksesori mewah', 'Kontrol stok edisi terbatas (capsule drop)', 'Profil selera belanja dan pengukuran klien VIP', 'Sistem kasir butik (Boutique POS) terintegrasi', 'Penjadwalan sesi private fitting eksklusif', 'Analitik tren penjualan omnichannel butik'],
    ['React', 'TypeScript', 'Motion', 'GSAP', 'Tailwind CSS'],
    'Ambrel menghadirkan pengalaman digital berkelas tinggi bagi brand fashion mewah dan butik terpilih. Padukan layanan concierge personal dengan manajemen stok edisi terbatas secara presisi.',
    'https://labdits-16.vercel.app'
  ),
  product(
    '17',
    'halvo',
    'Halvo',
    'Pusat Kendali Rumah Pintar & Efisiensi Energi IoT',
    'Aplikasi Kustom',
    1199000,
    dash17,
    'blue',
    ['Integrasi kendali perangkat IoT seluruh ruangan', 'Skenario otomatisasi rumah (pagi, santai, malam)', 'Pemantauan konsumsi daya listrik real-time', 'Pengaturan iklim & pendingin ruangan adaptif', 'Notifikasi keamanan pintu dan sensor kebocoran', 'Antarmuka ramah sentuhan untuk tablet dinding'],
    ['React', 'TypeScript', 'Tailwind CSS', 'Lucide'],
    'Halvo mengubah hunian menjadi ekosistem cerdas yang hemat energi dan aman. Kendalikan pencahayaan, suhu, dan peralatan elektronik hanya dengan satu sentuhan di layar sentuh rumah Anda.',
    'https://labdits-17.vercel.app'
  ),
  product(
    '18',
    'nestra',
    'Nestra',
    'Dashboard Keamanan & Otomasi Kediaman Cerdas',
    'Aplikasi Kustom',
    1299000,
    dash18,
    'emerald',
    ['Pemantauan kamera pengawas & sensor perimeter', 'Akses gerbang & kunci pintu pintar biometrik', 'Pencahayaan ritmis sesuai siklus sirkadian', 'Statistik efisiensi daya listrik dan solar panel', 'Kontrol kualitas udara dan kelembapan interior', 'Integrasi notifikasi darurat langsung ke smartphone'],
    ['React', 'TypeScript', 'GSAP', 'Tailwind CSS', 'Lucide'],
    'Nestra memadukan keamanan tingkat tinggi dan kenyamanan hunian pintar premium. Pantau keamanan properti dan nikmati otomatisasi lingkungan rumah secara seamless dari mana saja.',
    'https://labdits-18.vercel.app'
  )
];
export const seedCustomers: [Customer, Customer, Customer] = [{ id:'c1', name:'Aditya Pratama', email:'aditya@example.com', whatsapp:'081234567890', status:'Active' }, { id:'c2', name:'Sarah Wijaya', email:'sarah@example.com', whatsapp:'081298765432', status:'Active' }, { id:'c3', name:'Bima Santoso', email:'bima@example.com', whatsapp:'081211223344', status:'Inactive' }];
export const seedOrders: Order[] = [{ id:'LAB-1042', customer:seedCustomers[0], items:[{ productId:'1', license:'commercial', quantity:1 }], total:1798000, date:'2026-10-10', paymentMethod:'QRIS', status:'Paid', simulated:false },{ id:'LAB-1041', customer:seedCustomers[1], items:[{ productId:'2', license:'personal', quantity:1 }], total:1499000, date:'2026-10-09', paymentMethod:'Virtual Account', status:'Paid', simulated:false },{ id:'LAB-1040', customer:seedCustomers[2], items:[{ productId:'3', license:'personal', quantity:1 }], total:1299000, date:'2026-10-08', paymentMethod:'Bank Transfer', status:'Paid', simulated:false }];
export const chartData = [{ name:'Mei', revenue:18, views:2100 },{ name:'Jun', revenue:26, views:3200 },{ name:'Jul', revenue:22, views:2900 },{ name:'Agu', revenue:41, views:4700 },{ name:'Sep', revenue:35, views:4100 },{ name:'Okt', revenue:57, views:6200 }];
