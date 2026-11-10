export interface Config { apiKey: string; webhookSecret: string; supabaseUrl: string; serviceKey: string; allowedOrigin: string; returnOrigin: string }
export interface Database {
  user(token: string): Promise<{ id: string; email?: string } | null>;
  reserve(userId: string, email: string, cart: Cart): Promise<{ order_id: string; base_amount: number }>;
  activate(orderId: string, data: GatewayTransaction): Promise<void>;
  fail(orderId: string): Promise<void>;
  order(orderId: string, userId: string): Promise<Order | null>;
  apply(deliveryId: string, payload: PaymentEvent): Promise<string>;
}
interface Cart { items: { productId: string; license: string; quantity: number }[]; customer_name: string; customer_whatsapp: string; payment_method: 'QRIS' | 'BANK_TRANSFER'; return_url: string }
interface GatewayTransaction { transaction_id: string; checkout_url: string; base_amount: number; total_amount: number; unique_code: number; expires_at: string }
interface PaymentEvent { event: string; external_order_id: string; transaction_id: string; base_amount: number; total_amount: number; paid_at?: string }
interface Order { order_id: string; status: string; total_amount: number; base_amount: number; transaction_id: string | null; expires_at: string | null; checkout_url: string | null }
const encode = (s: string) => new TextEncoder().encode(s);
function hex(bytes: Uint8Array) { return [...bytes].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function verifyWebhook(raw: string, timestamp: string, signature: string, secret: string, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!secret || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300 || !/^(?:sha256=)?[0-9a-fA-F]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encode(timestamp + '.' + raw)));
  const provided = signature.replace(/^sha256=/, '').toLowerCase();
  // Fixed-length byte comparison; no short-circuit on mismatched bytes.
  let difference = 0;
  const expected = hex(digest);
  for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return difference === 0;
}
type Fields = Record<string, unknown> & { items?: unknown; productId?: unknown; license?: unknown; quantity?: number; customer_name?: unknown; customer_whatsapp?: unknown; payment_method?: unknown; return_url?: unknown; checkout_url?: unknown; transaction_id?: unknown; external_order_id?: unknown; base_amount?: unknown; total_amount?: unknown; unique_code?: number; expires_at?: unknown; event?: unknown; paid_at?: unknown; data?: unknown };
function isObject(v: unknown): v is Fields { return !!v && typeof v === 'object' && !Array.isArray(v); }
function validCart(v: unknown, returnOrigin: string): v is Cart {
  if (!isObject(v) || !Array.isArray(v.items) || v.items.length < 1 || v.items.length > 20 ||
    !v.items.every(x => isObject(x) && Object.keys(x).sort().join(',') === 'license,productId,quantity' &&
      typeof x.productId === 'string' && x.productId.length > 0 && x.productId.length <= 100 &&
      ['personal', 'commercial', 'installation'].includes(String(x.license)) && Number.isInteger(x.quantity) && typeof x.quantity === 'number' && x.quantity >= 1 && x.quantity <= 10) ||
    typeof v.customer_name !== 'string' || v.customer_name.trim().length < 1 || v.customer_name.length > 120 ||
    typeof v.customer_whatsapp !== 'string' || !/^\+?[\d\s()-]{7,25}$/.test(v.customer_whatsapp) ||
    !['QRIS', 'BANK_TRANSFER'].includes(String(v.payment_method)) || typeof v.return_url !== 'string') return false;
  try { const url = new URL(v.return_url); return url.origin === returnOrigin && url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function validTransaction(v: unknown, orderId: string, amount: number): v is GatewayTransaction {
  if (!isObject(v)) return false;
  try {
    // Only direct buyers to the provider's verified checkout host.
    const url = new URL(String(v.checkout_url));
    return v.external_order_id === orderId &&
      typeof v.transaction_id === 'string' && v.transaction_id.length > 0 && v.transaction_id.length <= 100 &&
      url.origin === 'https://qrisgate.web.id' && url.pathname === `/pay/${encodeURIComponent(v.transaction_id)}` &&
      !url.username && !url.password && !url.search && !url.hash &&
      v.base_amount === amount && Number.isSafeInteger(v.unique_code) && typeof v.unique_code === 'number' && v.unique_code >= 1 && v.unique_code <= 99 &&
      v.total_amount === amount + Number(v.unique_code) && typeof v.expires_at === 'string' && !Number.isNaN(Date.parse(v.expires_at));
  } catch { return false; }
}
function validPayment(v: unknown): v is PaymentEvent {
  return isObject(v) && ['payment.paid', 'payment.expired', 'payment.cancelled'].includes(String(v.event)) &&
    typeof v.external_order_id === 'string' && v.external_order_id.length > 0 && v.external_order_id.length <= 200 &&
    typeof v.transaction_id === 'string' && v.transaction_id.length > 0 && v.transaction_id.length <= 100 &&
    Number.isSafeInteger(Number(v.base_amount)) && Number(v.base_amount) > 0 && Number.isSafeInteger(Number(v.total_amount)) && Number(v.total_amount) > 0 &&
    (v.event !== 'payment.paid' || typeof v.paid_at === 'string' && !Number.isNaN(Date.parse(v.paid_at)));
}
export function createHandler({ config, db, fetchGateway }: { config: Config; db: Database; fetchGateway: typeof fetch }) {
  return async (req: Request): Promise<Response> => {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': config.allowedOrigin || 'null', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' };
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!config.apiKey || !config.webhookSecret || !config.supabaseUrl || !config.serviceKey || !config.allowedOrigin || !config.returnOrigin) return respond({ error: 'Service unavailable' }, 503);
    const route = new URL(req.url);
    if (route.pathname.endsWith('/webhook') && req.method === 'POST') {
      const raw = await req.text();
      if (raw.length > 16384) return respond({ error: 'Payload too large' }, 413);
      const timestamp = req.headers.get('x-qrisgate-timestamp') || '';
      const signature = req.headers.get('x-qrisgate-signature') || '';
      if (!await verifyWebhook(raw, timestamp, signature, config.webhookSecret)) return respond({ error: 'Invalid signature' }, 401);
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { return respond({ error: 'Invalid payload' }, 400); }
      // Only a verified non-payment probe may omit a delivery ID. Never apply it to an order.
      if (!isObject(payload)) return respond({ error: 'Invalid payload' }, 400);
      const event = payload.event ?? payload['type'];
      const paymentFields = ['transaction_id', 'external_order_id', 'base_amount', 'total_amount', 'paid_at'];
      const isPayment = typeof event === 'string' && event.startsWith('payment.') ||
        paymentFields.some(field => field in payload);
      if (!isPayment) return respond({ received: true });
      if (!validPayment(payload)) return respond({ error: 'Invalid payload' }, 400);
      const deliveryId = req.headers.get('x-qrisgate-delivery-id');
      if (!deliveryId || deliveryId.length > 200) return respond({ error: 'Missing delivery ID' }, 400);
      try { await db.apply(deliveryId, payload); return respond({ received: true }); }
      catch { return respond({ error: 'Processing failed' }, 500); }
    }
    const bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return respond({ error: 'Authentication required' }, 401);
    let user: { id: string; email?: string } | null;
    try { user = await db.user(bearer); } catch { return respond({ error: 'Authentication failed' }, 401); }
    if (!user) return respond({ error: 'Authentication required' }, 401);
    if (route.pathname.endsWith('/checkout') && req.method === 'POST') {
      let cart: unknown;
      try { cart = await req.json(); } catch { return respond({ error: 'Invalid body' }, 400); }
      if (!validCart(cart, config.returnOrigin)) return respond({ error: 'Invalid checkout' }, 400);
      let reserved: { order_id: string; base_amount: number };
      try { reserved = await db.reserve(user.id, user.email || '', cart); }
      catch { return respond({ error: 'Invalid product or pricing' }, 400); }
      let response: Response;
      try { response = await fetchGateway('https://qrisgate.web.id/api/v1/transactions', {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_order_id: reserved.order_id, amount: reserved.base_amount, customer_name: cart.customer_name, payment_method: cart.payment_method, return_url: `${config.returnOrigin}/order/${encodeURIComponent(reserved.order_id)}` }),
      }); } catch { await db.fail(reserved.order_id); return respond({ error: 'Payment provider unavailable' }, 502); }
      if (!response.ok) {
        await db.fail(reserved.order_id);
        return respond({ error: 'Payment provider rejected checkout' }, [400, 402, 429].includes(response.status) ? response.status : 502);
      }
      let json: unknown;
      try { json = await response.json(); } catch { json = null; }
      const data = isObject(json) ? json.data : null;
      if (!validTransaction(data, reserved.order_id, reserved.base_amount)) {
        // Do not mark failed: a gateway transaction may exist and needs reconciliation.
        return respond({ error: 'Payment provider response needs reconciliation', order_id: reserved.order_id }, 502);
      }
      try { await db.activate(reserved.order_id, data); }
      catch { return respond({ error: 'Checkout needs reconciliation', order_id: reserved.order_id }, 503); }
      return respond({ order_id: reserved.order_id, transaction_id: data.transaction_id, checkout_url: data.checkout_url, total_amount: data.total_amount, expires_at: data.expires_at }, 201);
    }
    if (route.pathname.endsWith('/status') && req.method === 'GET') {
      const orderId = route.searchParams.get('order_id') || '';
      if (!/^qg_[0-9a-f-]{32,40}$/.test(orderId)) return respond({ error: 'Invalid order' }, 400);
      try {
        let order = await db.order(orderId, user.id);
        if (!order) return respond({ error: 'Not found' }, 404);
        if (order.status === 'Pending' && order.transaction_id) {
          try {
            const gateway = await fetchGateway(`https://qrisgate.web.id/api/v1/transactions/${encodeURIComponent(order.transaction_id)}`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
            if (gateway.ok) {
              const payload = await gateway.json();
              const result = payload?.data;
              const event = result?.status === 'PAID' ? 'payment.paid' : result?.status === 'EXPIRED' ? 'payment.expired' : result?.status === 'CANCELLED' ? 'payment.cancelled' : null;
              if (event && result.transaction_id === order.transaction_id && result.external_order_id === orderId && result.base_amount === order.base_amount && result.total_amount === order.total_amount) {
                await db.apply(`poll:${order.transaction_id}:${event}`, { event, transaction_id: order.transaction_id, external_order_id: orderId, base_amount: order.base_amount, total_amount: order.total_amount, paid_at: result.paid_at });
                order = await db.order(orderId, user.id);
              }
            }
          } catch { /* Preserve local status if gateway is unreachable. */ }
        }
        return respond({ order_id: order!.order_id, status: order!.status, total_amount: order!.total_amount, expires_at: order!.expires_at, checkout_url: order!.checkout_url });
      } catch { return respond({ error: 'Status unavailable' }, 503); }
    }
    return respond({ error: 'Not found' }, 404);
  };
}
