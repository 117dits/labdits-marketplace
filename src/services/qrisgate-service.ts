import type { CartItem } from '@/types';

export interface QrisgateCheckoutInput {
  items: Pick<CartItem, 'productId' | 'license' | 'quantity'>[];
  customer_name: string;
  customer_whatsapp: string;
  payment_method: 'QRIS' | 'BANK_TRANSFER';
}
export interface QrisgateOrder {
  order_id: string;
  transaction_id?: string;
  status?: 'Pending' | 'Paid' | 'Expired' | 'Cancelled' | 'Failed';
  checkout_url: string;
  total_amount: number;
  expires_at: string;
}
interface GatewayConfig {
  url: string;
  key: string;
  fetcher?: typeof fetch;
  origin?: string;
}
function browserConfig(): GatewayConfig {
  return {
    url: import.meta.env['VITE_SUPABASE_URL'] || '',
    key: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '',
  };
}
async function request(path: string, token: string | null, config: GatewayConfig, init?: RequestInit): Promise<QrisgateOrder> {
  if (!token) throw new Error('Silakan masuk dengan akun Supabase untuk checkout.');
  if (!config.url || !config.key) throw new Error('Backend pembayaran belum dikonfigurasi.');
  const response = await (config.fetcher || fetch)(`${config.url.replace(/\/$/, '')}/functions/v1/qrisgate-api/${path}`, {
    ...init,
    headers: { apikey: config.key, Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Layanan pembayaran gagal (${response.status}).`;
    throw new Error(message);
  }
  if (!body || typeof body !== 'object' || !('order_id' in body) || typeof body.order_id !== 'string') throw new Error('Respons pembayaran tidak valid.');
  return body as QrisgateOrder;
}
export function createQrisgateCheckout(input: QrisgateCheckoutInput, token: string | null, config: GatewayConfig = browserConfig()): Promise<QrisgateOrder> {
  const origin = config.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return request('checkout', token, config, { method: 'POST', body: JSON.stringify({ ...input, return_url: `${origin}/account/orders` }) });
}
export function getQrisgateOrder(orderId: string, token: string | null, config: GatewayConfig = browserConfig()): Promise<QrisgateOrder> {
  return request(`status?order_id=${encodeURIComponent(orderId)}`, token, config);
}
