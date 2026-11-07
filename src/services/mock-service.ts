import type { Product, CartItem, Order, DemoSession } from '@/types';
export interface MarketplaceState { products: Product[]; cart: CartItem[]; orders: Order[]; session: DemoSession | null; settings: Record<string, string> }
// Browser-only mock adapter. Replace this boundary with API calls for secure backend integration.
export const mockService = {
 read(): MarketplaceState | null { try { const raw = localStorage.getItem('labdits-prototype-v1'); return raw ? JSON.parse(raw) : null; } catch { return null; } },
 write(state: MarketplaceState) { try { localStorage.setItem('labdits-prototype-v1', JSON.stringify(state)); } catch { /* Storage may be unavailable in private browsing. */ } },
 async validateProjectFiles(files: File[]) { return files.map(file => ({ name: file.name, valid: true, reason: 'Berkas valid dan siap diproses' })); },
  async downloadExample(name: string, license: string = 'commercial', orderId: string = 'INV-DITS') {
    const content = `# LABDITS — ${name.toUpperCase()} SOURCE CODE & DOKUMENTASI
==================================================
Lisensi Resmi: ${license.toUpperCase()}
Kode Invoice: ${orderId}
Tanggal Penerbitan: ${new Date().toISOString().slice(0, 10)}
Penerbit: LABDITS / DITSSTORE (https://github.com/117dits)
WhatsApp Bantuan: 0858-8284-6665

PANDUAN INSTALASI & SETUP CEPAT:
1. Ekstrak paket source code ke direktori kerja Anda.
2. Jalankan perintah instalasi dependency:
     npm install
3. Buat salinan konfigurasi environment:
     cp .env.example .env
4. Mulai server pengembangan:
     npm run dev
5. Buka http://localhost:5173 di browser Anda.

Jika Anda membutuhkan bantuan deployment atau kustomisasi lebih lanjut, silakan hubungi tim kami via WhatsApp di 0858-8284-6665. Terima kasih!
`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '-')}-source-code.md`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
