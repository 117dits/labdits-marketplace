import type { Product, CartItem, Order, DemoSession } from '@/types';
export interface MarketplaceState { products: Product[]; cart: CartItem[]; orders: Order[]; session: DemoSession | null; settings: Record<string, string> }
// Browser-only mock adapter. Replace this boundary with API calls for secure backend integration.
export const mockService = {
 read(): MarketplaceState | null { try { const raw = localStorage.getItem('labdits-prototype-v1'); return raw ? JSON.parse(raw) : null; } catch { return null; } },
 write(state: MarketplaceState) { try { localStorage.setItem('labdits-prototype-v1', JSON.stringify(state)); } catch { /* Storage may be unavailable in private browsing. */ } },
 async validateProjectFiles(files: File[]) { return files.map(file => ({ name: file.name, valid: true, reason: 'Ready for simulated upload' })); },
 async downloadExample(name: string) { const blob = new Blob([`LABDITS — ${name}\nDEMO DOWNLOAD ONLY\nNo source code is included in this prototype. Secure downloads will be provided after backend integration.`], { type:'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`${name}-demo-readme.txt`; a.click(); URL.revokeObjectURL(url); },
};
