import type { Product } from '@/types';
import { isDeploymentLive } from '@/types';

/** Public preview content must live at a separate HTTPS origin, not loopback or LABDITS itself. */
export function publicPreviewUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !host.includes('.') || url.username || url.password) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host.includes('labdits.lovable.app')) return null;
    // Reject literal IPs, including alternate IPv4 spellings normalized by URL().
    // This is a browser UX guard; actual preview verification belongs on the backend.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** An explicit external demo can be used even when uploaded source has not been built. */
export function shouldShowBundledDemo(product: Product): boolean {
  return !product.project && !product.files?.length && product.demoMode !== 'iframe';
}

export function resolvePublicDemo(product: Product): string | null {
  const external = product.demoMode !== 'mock' ? publicPreviewUrl(product.demoUrl) : null;
  if (external) return external;
  const deployment = product.project?.deployment;
  return isDeploymentLive(deployment) ? publicPreviewUrl(deployment.previewUrl) : null;
}
