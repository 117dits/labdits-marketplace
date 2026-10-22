import finance from '@/assets/financeflow.jpg';
import retail from '@/assets/retailpos.jpg';
import task from '@/assets/taskpilot.jpg';
import event from '@/assets/eventsphere.jpg';
import commerce from '@/assets/commercekit.svg';
import wedding from '@/assets/sakinah.svg';
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
const product = (id: string, name: string, subtitle: string, category: string, price: number, image: string, theme: string, features: string[], stack = ['React', 'TypeScript', 'Tailwind CSS']): Product => ({ id, slug: name.toLowerCase(), name, subtitle, category, price, image, theme, features, stack, description: `${subtitle}, dirancang profesional untuk bisnis modern. ${name} menggabungkan antarmuka interaktif yang elegan, performa tinggi, dan struktur kode yang rapi serta mudah dikembangkan. Siap digunakan dan diluncurkan langsung.`, commercialPrice: price * 2, installationPrice: price * 3, featured: true, status: 'published', popularity: 100 - Number(id) * 9, version: '2.1.0', updated: '2026-10-08', devices: ['Desktop', 'Tablet', 'Mobile'], freeDemo: true });
export const seedProducts: Product[] = [
product('1', 'FinanceFlow', 'Dashboard Manajemen Keuangan & Arus Kas', 'Dashboard Admin', 899000, finance, 'mint', ['Ringkasan keuangan real-time', 'Pelacakan pemasukan & pengeluaran', 'Manajemen multi-rekening kas', 'Laporan keuangan siap unduh', 'Perencanaan anggaran belanja', 'Hak akses berbasis peran']),
product('2', 'RetailPOS', 'Sistem Kasir Modern & Inventaris Toko', 'Sistem POS & Kasir', 1499000, retail, 'coral', ['Proses checkout kasir kilat', 'Manajemen produk & stok barang', 'Cetak & unduh nota transaksi', 'Fitur loyalitas pelanggan', 'Analitik penjualan terpadu', 'Mendukung multi-cabang']),
product('3', 'TaskPilot', 'Platform Manajemen Proyek & Tugas Tim', 'Aplikasi SaaS', 1299000, task, 'violet', ['Papan Kanban interaktif drag & drop', 'Workspace kolaborasi tim', 'Delegasi & tenggat waktu tugas', 'Garis waktu proyek (timeline)', 'Aktivitas tim real-time', 'Pelacak waktu kerja']),
product('4', 'EventSphere', 'Portal Penjualan Tiket & Manajemen Acara', 'Website Bisnis', 1899000, event, 'lime', ['Katalog penjelajahan acara', 'Pemesanan tiket online terintegrasi', 'Dashboard pengelola acara', 'Tiket ber-barcode / QR code', 'Analitik penjualan tiket', 'Tampilan responsif semua perangkat']),
product('5', 'CommerceKit', 'Dashboard Toko Online & Pesanan', 'E-Commerce', 999000, commerce, 'cyan', ['Manajemen pesanan pelanggan', 'Pelacakan stok & inventaris', 'Profil & riwayat pembeli', 'Kampanye kupon & diskon', 'Katalog produk digital & fisik', 'Laporan performa omzet'], ['Next.js', 'TypeScript', 'Tailwind CSS']),
product('6', 'Sakinah', 'Platform Undangan Pernikahan Digital Interaktif', 'Landing Page', 499000, wedding, 'rose', ['Undangan personal untuk setiap tamu', 'Konfirmasi kehadiran (RSVP) online', 'Galeri foto & cerita pasangan', 'Hitung mundur hari bahagia', 'Buku ucapan & doa tamu', 'Desain responsif ponsel yang memukau'], ['React', 'TypeScript', 'Motion']),
];
export const seedCustomers: [Customer, Customer, Customer] = [{ id:'c1', name:'Aditya Pratama', email:'aditya@example.com', whatsapp:'081234567890', status:'Active' }, { id:'c2', name:'Sarah Wijaya', email:'sarah@example.com', whatsapp:'081298765432', status:'Active' }, { id:'c3', name:'Bima Santoso', email:'bima@example.com', whatsapp:'081211223344', status:'Inactive' }];
export const seedOrders: Order[] = [{ id:'LAB-1042', customer:seedCustomers[0], items:[{ productId:'1', license:'commercial', quantity:1 }], total:1798000, date:'2026-10-10', paymentMethod:'QRIS', status:'Paid', simulated:false },{ id:'LAB-1041', customer:seedCustomers[1], items:[{ productId:'2', license:'personal', quantity:1 }], total:1499000, date:'2026-10-09', paymentMethod:'Virtual Account', status:'Paid', simulated:false },{ id:'LAB-1040', customer:seedCustomers[2], items:[{ productId:'3', license:'personal', quantity:1 }], total:1299000, date:'2026-10-08', paymentMethod:'Bank Transfer', status:'Paid', simulated:false }];
export const chartData = [{ name:'Mei', revenue:18, views:2100 },{ name:'Jun', revenue:26, views:3200 },{ name:'Jul', revenue:22, views:2900 },{ name:'Agu', revenue:41, views:4700 },{ name:'Sep', revenue:35, views:4100 },{ name:'Okt', revenue:57, views:6200 }];
