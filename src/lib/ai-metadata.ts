import { categories } from '@/data/products';
import { projectSlug } from '@/lib/product-wizard-flow';

export interface AIMetadataInput {
  rawTitle?: string | undefined;
  rawDescription?: string | undefined;
  files?: string[] | undefined;
  packageJson?: Record<string, unknown> | undefined;
  headings?: string[] | undefined;
  category?: string | undefined;
  dependencies?: Record<string, string> | undefined;
}

export interface AIMetadataResult {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  features: string[];
  category: string;
  stack: string[];
  suggestedPrices?: {
    price: number;
    commercialPrice: number;
    installationPrice: number;
  } | undefined;
  aiGenerated: boolean;
}

export function isAIMetadataSupported(): boolean {
  return true;
}

const CATEGORY_MAP: Record<string, {
  name: string;
  price: number;
  commercialPrice: number;
  installationPrice: number;
  defaultFeatures: string[];
  defaultSubtitle: string;
  defaultDescription: string;
}> = {
  pos: {
    name: 'Sistem POS & Kasir',
    price: 1499000,
    commercialPrice: 2998000,
    installationPrice: 4497000,
    defaultSubtitle: 'Solusi kasir modern dengan pencatatan transaksi cepat dan manajemen stok terintegrasi.',
    defaultDescription: 'Sistem POS (Point of Sale) & Kasir lengkap yang dirancang khusus untuk mempercepat alur transaksi toko fisik maupun ritel modern. Dilengkapi dengan manajemen stok barang otomatis, cetak struk kasir, pemindaian barcode, serta laporan penjualan harian dan bulanan yang akurat untuk mendukung pertumbuhan bisnis Anda.',
    defaultFeatures: [
      'Pencatatan transaksi kasir cepat & akurat',
      'Manajemen stok produk & peringatan stok menipis',
      'Laporan omzet penjualan & analitik harian',
      'Dukungan cetak struk nota belanja & barcode',
      'Desain antarmuka responsif untuk tablet, POS & PC',
    ],
  },
  ecommerce: {
    name: 'E-Commerce',
    price: 999000,
    commercialPrice: 1998000,
    installationPrice: 2997000,
    defaultSubtitle: 'Platform toko online modern dengan keranjang belanja dan katalog interaktif.',
    defaultDescription: 'Platform E-Commerce siap pakai yang memadukan pengalaman belanja online menyenangkan dengan panel kelola produk yang intuitif. Memudahkan pelanggan menjelajahi katalog, memesan produk, dan mengelola pesanan dengan performa tinggi.',
    defaultFeatures: [
      'Katalog produk interaktif dengan varian & filter',
      'Keranjang belanja real-time & alur checkout instan',
      'Panel manajemen pesanan & status pengiriman',
      'Tampilan mobile-first yang dioptimalkan untuk konversi',
      'Kode bersih dengan arsitektur modern siap kustomisasi',
    ],
  },
  dashboard: {
    name: 'Dashboard Admin',
    price: 899000,
    commercialPrice: 1798000,
    installationPrice: 2697000,
    defaultSubtitle: 'Dashboard manajemen dan pemantauan metrik bisnis dengan visualisasi data interaktif.',
    defaultDescription: 'Dashboard admin profesional yang dirancang untuk memberikan visibilitas penuh atas operasional bisnis Anda. Menyajikan grafik performa, statistik transaksi, manajemen pengguna, serta ringkasan aktivitas dalam antarmuka yang bersih, modern, dan mudah dipahami.',
    defaultFeatures: [
      'Visualisasi grafik & metrik performa interaktif',
      'Manajemen data tabel lengkap dengan filter & ekspor',
      'Sistem peran & otorisasi hak akses pengguna',
      'Tema antarmuka elegan dengan mode gelap/terang',
      'Komponen UI modular yang fleksibel untuk berbagai kebutuhan',
    ],
  },
  saas: {
    name: 'Aplikasi SaaS',
    price: 1299000,
    commercialPrice: 2598000,
    installationPrice: 3897000,
    defaultSubtitle: 'Platform software-as-a-service modern dengan manajemen workspace dan kolaborasi tim.',
    defaultDescription: 'Arsitektur aplikasi SaaS modern siap produksi yang menyediakan fungsionalitas workspace kolaboratif, manajemen langganan, dan automasi alur kerja tim. Dibangun dengan standar performa dan keamanan tinggi untuk mempercepat peluncuran produk digital Anda.',
    defaultFeatures: [
      'Workspace kolaboratif & manajemen anggota tim',
      'Sistem langganan, paket fitur & pembagian kuota',
      'Notifikasi real-time & riwayat aktivitas tim',
      'API siap integrasi & penyimpanan data terisolasi',
      'Fondasi kode TypeScript type-safe siap scale up',
    ],
  },
  landing: {
    name: 'Landing Page',
    price: 499000,
    commercialPrice: 998000,
    installationPrice: 1497000,
    defaultSubtitle: 'Halaman arahan dengan estetika premium dan fokus konversi tinggi.',
    defaultDescription: 'Halaman arahan (landing page) berdesain kelas atas yang memikat perhatian pengunjung dan mendorong konversi optimal. Dilengkapi animasi halus, tata letak responsif, serta penempatan call-to-action strategis untuk memaksimalkan hasil kampanye Anda.',
    defaultFeatures: [
      'Hero section menawan dengan animasi modern',
      'Pemaparan keunggulan produk & testimoni terpercaya',
      'Formulir pendaftaran / kontak langsung WhatsApp',
      'Skor performa dan kecepatan muat ultra cepat',
      'SEO-friendly dan optimal di semua ukuran layar ponsel',
    ],
  },
  business: {
    name: 'Website Bisnis',
    price: 899000,
    commercialPrice: 1798000,
    installationPrice: 2697000,
    defaultSubtitle: 'Website profil perusahaan profesional untuk membangun kredibilitas bisnis.',
    defaultDescription: 'Solusi website perusahaan yang mencerminkan profesionalisme dan kredibilitas brand Anda. Menyajikan profil layanan, portofolio proyek, serta informasi kontak dengan tata letak elegan dan navigasi intuitif.',
    defaultFeatures: [
      'Profil perusahaan & etalase portofolio profesional',
      'Katalog layanan & detail solusi bisnis',
      'Integrasi tautan kontak langsung & media sosial',
      'Desain korporat modern dengan hierarki visual jelas',
      'Dukungan multi-halaman yang fleksibel diperluas',
    ],
  },
};

export async function generateAIMetadata(input: AIMetadataInput): Promise<AIMetadataResult> {
  const allTokens = [
    input.rawTitle || '',
    input.rawDescription || '',
    ...(input.files || []),
    ...(input.headings || []),
    JSON.stringify(input.packageJson || {}),
  ].join(' ').toLowerCase();

  // 1. Detect Category Domain
  let detectedKey = 'dashboard';
  if (/kasir|point of sale|\bpos\b|struk|cashier|stok|penjualan/.test(allTokens)) {
    detectedKey = 'pos';
  } else if (/saas|subscription|billing|langganan|workspace|tenant|team/.test(allTokens)) {
    detectedKey = 'saas';
  } else if (/toko|ecommerce|e-commerce|keranjang|belanja|checkout|cart|store/.test(allTokens)) {
    detectedKey = 'ecommerce';
  } else if (/landing|undangan|wedding|portofolio|profile|halaman arahan/.test(allTokens)) {
    detectedKey = 'landing';
  } else if (/perusahaan|company|agency|bisnis|layanan|corporate/.test(allTokens)) {
    detectedKey = 'business';
  }

  const categoryConfig = CATEGORY_MAP[detectedKey] || CATEGORY_MAP['dashboard']!;
  const categoryName = categories.find((c) => c.toLowerCase() === categoryConfig.name.toLowerCase()) || categoryConfig.name;

  // 2. Synthesize High-Impact Product Title
  let title = (input.rawTitle || '').trim();
  const genericPattern = /^(app|my-app|my app|starter|template|vite \+ react|react-app|next-app|dashboard|index|pos-app|saas-starter)$/i;
  if (!title || genericPattern.test(title)) {
    if (detectedKey === 'pos') title = 'Kasir Pro - Sistem POS & Manajemen Stok';
    else if (detectedKey === 'saas') title = 'CollabSpace - Platform Kolaborasi SaaS Modern';
    else if (detectedKey === 'ecommerce') title = 'TokoSmart - Solusi E-Commerce & Toko Online';
    else if (detectedKey === 'landing') title = 'LaunchPad - Landing Page Premium';
    else if (detectedKey === 'business') title = 'CorpSite - Website Profil Bisnis Modern';
    else title = 'AdminFlow - Dashboard Manajemen Bisnis';
  } else {
    // Polish raw title into proper title case if necessary
    title = title.replace(/^@[\w-]+\//, '').replace(/[-_]+/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // 3. Synthesize SEO Slug
  const slug = projectSlug(title) || `aplikasi-${Date.now().toString(36)}`;

  // 4. Synthesize Subtitle
  const subtitle = input.rawDescription && input.rawDescription.length > 20 && input.rawDescription.length <= 130
    ? input.rawDescription
    : categoryConfig.defaultSubtitle;

  // 5. Synthesize Persuasive Indonesian Description
  let description = categoryConfig.defaultDescription;
  if (input.rawDescription && input.rawDescription.length > 60) {
    description = `${input.rawDescription}\n\n${categoryConfig.defaultDescription}`;
  }

  // 6. Synthesize Features
  const featuresSet = new Set<string>();
  // Include valid headings if meaningful
  if (input.headings && input.headings.length) {
    input.headings.forEach((h) => {
      const clean = h.trim();
      if (clean.length >= 6 && clean.length <= 80 && !/^(home|index|menu|contact|footer|header|app)$/i.test(clean)) {
        featuresSet.add(clean);
      }
    });
  }
  // Fill remaining from category defaults
  categoryConfig.defaultFeatures.forEach((f) => featuresSet.add(f));
  const features = Array.from(featuresSet).slice(0, 6);

  // 7. Detect Stack
  const deps = {
    ...(input.dependencies || {}),
    ...((input.packageJson?.['dependencies'] as Record<string, string>) || {}),
    ...((input.packageJson?.['devDependencies'] as Record<string, string>) || {}),
  };
  const stack: string[] = [];
  if (deps['next'] || allTokens.includes('next.js')) stack.push('Next.js');
  if (deps['react'] || allTokens.includes('react')) stack.push('React');
  if (deps['vue'] || allTokens.includes('vue')) stack.push('Vue');
  if (deps['svelte'] || allTokens.includes('svelte')) stack.push('Svelte');
  if (deps['typescript'] || allTokens.includes('typescript')) stack.push('TypeScript');
  if (deps['tailwindcss'] || deps['@tailwindcss/vite'] || allTokens.includes('tailwindcss')) stack.push('Tailwind CSS');
  if (deps['@supabase/supabase-js'] || allTokens.includes('supabase')) stack.push('Supabase');
  if (!stack.length) stack.push('React', 'TypeScript', 'Tailwind CSS');

  return {
    title,
    slug,
    subtitle,
    description,
    features,
    category: categoryName,
    stack: Array.from(new Set(stack)),
    suggestedPrices: {
      price: categoryConfig.price,
      commercialPrice: categoryConfig.commercialPrice,
      installationPrice: categoryConfig.installationPrice,
    },
    aiGenerated: true,
  };
}
