import type { Product } from "@/types";
import { resolvePublicDemo } from "@/lib/public-demo";

/** Returns blocking issues; empty array means the product may be published. */
export function publishReadiness(p: Product): string[] {
  const issues: string[] = [];
  if (!p.name.trim() || !p.slug.trim()) issues.push("Lengkapi nama dan slug produk.");
  if (new Set(['admin', 'account', 'about', 'cart', 'categories', 'checkout', 'contact', 'demo', 'how-it-works', 'licenses', 'login', 'products', 'support']).has(p.slug.toLowerCase()))
    issues.push('Slug ini digunakan halaman LABDITS. Pilih slug lain.');
  if (!p.description.trim()) issues.push("Lengkapi deskripsi produk.");
  if (!(p.price > 0)) issues.push("Atur harga lisensi personal.");
  if (!resolvePublicDemo(p))
    issues.push(
      "Tambahkan URL demo HTTPS publik yang terpisah, atau deploy proyek hingga pratinjau HTTPS terverifikasi sebelum diterbitkan.",
    );
  return issues;
}
