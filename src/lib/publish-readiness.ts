import type { Product } from "@/types";
import { resolvePublicDemo } from "@/lib/public-demo";

/** Returns blocking issues; empty array means the product may be published. */
export function publishReadiness(p: Product): string[] {
  const issues: string[] = [];
  if (!p.name.trim() || !p.slug.trim()) issues.push("Add a product name and slug.");
  if (new Set(['admin', 'account', 'about', 'cart', 'categories', 'checkout', 'contact', 'demo', 'how-it-works', 'licenses', 'login', 'products', 'support']).has(p.slug.toLowerCase()))
    issues.push('This slug is reserved by a LABDITS page. Choose another slug.');
  if (!p.description.trim()) issues.push("Add a product description.");
  if (!(p.price > 0)) issues.push("Set a personal license price.");
  if (!resolvePublicDemo(p))
    issues.push(
      "Add a separate public HTTPS demo URL, or deploy the project to a verified public HTTPS preview before publishing.",
    );
  return issues;
}
