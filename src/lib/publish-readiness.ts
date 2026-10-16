import { isDeploymentLive, type Product } from '@/types';

/** Returns blocking issues; empty array means the product may be published. */
export function publishReadiness(p: Product): string[] {
  const issues: string[] = [];
  if (!p.name.trim() || !p.slug.trim()) issues.push('Add a product name and slug.');
  if (!p.description.trim()) issues.push('Add a product description.');
  if (!(p.price > 0)) issues.push('Set a personal license price.');
  if (p.project && !isDeploymentLive(p.project.deployment)) issues.push('Live demo not confirmed: the deployment backend must return a verified preview URL before publishing.');
  return issues;
}
