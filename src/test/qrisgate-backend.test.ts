import { describe, expect, it } from 'vitest';
import { verifyWebhook, createHandler } from '../../supabase/functions/qrisgate-api/logic';

const secret = 'webhook-test-secret';
async function sign(timestamp: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

describe('QRISGate webhook signature', () => {
  it('accepts timestamp-dot-raw-bytes and rejects raw-body-only, replay and tampering', async () => {
    const now = 1780000000;
    const body = '{ "event":"payment.paid" }';
    const valid = await sign(String(now), body);
    expect(await verifyWebhook(body, String(now), valid, secret, now)).toBe(true);
    expect(await verifyWebhook(body, String(now), await sign('', body), secret, now)).toBe(false);
    expect(await verifyWebhook(body + ' ', String(now), valid, secret, now)).toBe(false);
    expect(await verifyWebhook(body, String(now - 301), valid, secret, now)).toBe(false);
    expect(await verifyWebhook(body, 'not-seconds', valid, secret, now)).toBe(false);
    expect(await verifyWebhook(body, String(now), valid.slice(0, -2), secret, now)).toBe(false);
  });
});

const url = 'https://example.supabase.co/functions/v1/qrisgate-api';
const config = { apiKey: 'qg_test', webhookSecret: secret, supabaseUrl: 'https://example.supabase.co', serviceKey: 'server-only', allowedOrigin: 'https://shop.example', returnOrigin: 'https://shop.example' };
const auth = { authorization: 'Bearer user-token', apikey: 'public-key', origin: 'https://shop.example' };
const cart = { items: [{ productId: '1', license: 'personal', quantity: 1 }], customer_name: 'Test User', customer_whatsapp: '08123456789', payment_method: 'QRIS', return_url: 'https://shop.example/thanks' };
function request(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe('endpoint security', () => {
  it('fails closed on missing configuration and rejects unauthenticated checkout', async () => {
    const handler = createHandler({ config: { ...config, apiKey: '' }, db: {} as never, fetchGateway: fetch });
    expect((await handler(request('/checkout', 'POST', cart, auth))).status).toBe(503);
    const configured = createHandler({ config, db: {} as never, fetchGateway: fetch });
    expect((await configured(request('/checkout', 'POST', cart))).status).toBe(401);
  });

  it('does not trust browser prices or accept invalid cart values', async () => {
    let called = false;
    const handler = createHandler({ config, db: { user: async () => ({ id: 'user-1', email: 'a@b.c' }), reserve: async () => { called = true; throw new Error('unexpected'); } } as never, fetchGateway: fetch });
    for (const changed of [{ ...cart, items: [{ ...cart.items[0], quantity: 0 }] }, { ...cart, items: [{ ...cart.items[0], price: 1 }] }, { ...cart, return_url: 'https://evil.example' }]) {
      expect((await handler(request('/checkout', 'POST', changed, auth))).status).toBe(400);
    }
    expect(called).toBe(false);
  });

  it('returns gateway checkout fields from a server-priced reservation without exposing a key', async () => {
    const calls: unknown[] = [];
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1', email: 'a@b.c' }),
      reserve: async (...args: unknown[]) => { calls.push(args); return { order_id: 'qg_order', base_amount: 899000 }; },
      activate: async (...args: unknown[]) => { calls.push(args); },
      fail: async () => {},
    } as never, fetchGateway: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return Response.json({ success: true, data: { transaction_id: 'trx_1', external_order_id: 'qg_order', checkout_url: 'https://qrisgate.web.id/pay/trx_1', base_amount: 899000, total_amount: 899007, unique_code: 7, expires_at: '2026-12-01T00:00:00Z' } }, { status: 201 });
    } });
    const result = await handler(request('/checkout', 'POST', cart, auth));
    expect(result.status).toBe(201);
    expect(await result.json()).toMatchObject({ order_id: 'qg_order', transaction_id: 'trx_1', total_amount: 899007 });
    expect(JSON.stringify(calls)).not.toContain('qg_test');
    expect(calls[1]).toMatchObject({ amount: 899000, external_order_id: 'qg_order', return_url: 'https://shop.example/order/qg_order' });
  });

  it('rejects a gateway response for a different order before activating checkout', async () => {
    let activated = false;
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1' }),
      reserve: async () => ({ order_id: 'qg_order', base_amount: 899000 }),
      activate: async () => { activated = true; },
    } as never, fetchGateway: async () => Response.json({ success: true, data: {
      transaction_id: 'trx_1', external_order_id: 'qg_another_order',
      checkout_url: 'https://qrisgate.web.id/pay/trx_1', base_amount: 899000,
      total_amount: 899007, unique_code: 7, expires_at: '2026-12-01T00:00:00Z',
    } }, { status: 201 }) });
    const response = await handler(request('/checkout', 'POST', cart, auth));
    expect(response.status).toBe(502);
    expect(activated).toBe(false);
  });

  it('rejects a zero unique code rather than creating an unactivatable order', async () => {
    let activated = false;
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1' }),
      reserve: async () => ({ order_id: 'qg_order', base_amount: 899000 }),
      activate: async () => { activated = true; },
    } as never, fetchGateway: async () => Response.json({ success: true, data: {
      transaction_id: 'trx_1', external_order_id: 'qg_order',
      checkout_url: 'https://qrisgate.web.id/pay/trx_1', base_amount: 899000,
      total_amount: 899000, unique_code: 0, expires_at: '2026-12-01T00:00:00Z',
    } }, { status: 201 }) });
    expect((await handler(request('/checkout', 'POST', cart, auth))).status).toBe(502);
    expect(activated).toBe(false);
  });

  it('rejects a gateway checkout link that does not belong to QRISGate', async () => {
    let activated = false;
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1' }),
      reserve: async () => ({ order_id: 'qg_order', base_amount: 899000 }),
      activate: async () => { activated = true; },
    } as never, fetchGateway: async () => Response.json({ success: true, data: {
      transaction_id: 'trx_1', external_order_id: 'qg_order',
      checkout_url: 'https://not-qrisgate.example/pay/trx_1', base_amount: 899000,
      total_amount: 899007, unique_code: 7, expires_at: '2026-12-01T00:00:00Z',
    } }, { status: 201 }) });
    const response = await handler(request('/checkout', 'POST', cart, auth));
    expect(response.status).toBe(502);
    expect(activated).toBe(false);
  });

  it('passes BANK_TRANSFER to the provider rather than silently defaulting to QRIS', async () => {
    let sent: Record<string, unknown> = {};
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1' }), reserve: async () => ({ order_id: 'qg_order', base_amount: 899000 }), activate: async () => {}, fail: async () => {},
    } as never, fetchGateway: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({ success: true, data: { transaction_id: 'trx_1', external_order_id: 'qg_order', checkout_url: 'https://qrisgate.web.id/pay/trx_1', base_amount: 899000, total_amount: 899007, unique_code: 7, expires_at: '2026-12-01T00:00:00Z' } }, { status: 201 });
    } });
    const response = await handler(request('/checkout', 'POST', { ...cart, payment_method: 'BANK_TRANSFER' }, auth));
    expect(response.status).toBe(201);
    expect(sent['payment_method']).toBe('BANK_TRANSFER');
  });

  it('never fetches gateway status for a non-owned order', async () => {
    let gatewayCalls = 0;
    const handler = createHandler({ config, db: {
      user: async () => ({ id: 'user-1' }), order: async () => null,
    } as never, fetchGateway: async () => { gatewayCalls++; return Response.json({}); } });
    expect((await handler(request('/status?order_id=qg_12345678-1234-4123-8123-123456789abc', 'GET', undefined, auth))).status).toBe(404);
    expect(gatewayCalls).toBe(0);
  });

  it('keeps local status if gateway polling is unreachable', async () => {
    const order = { order_id: 'qg_12345678-1234-4123-8123-123456789abc', status: 'Pending', total_amount: 899007, base_amount: 899000, transaction_id: 'trx_1', expires_at: null, checkout_url: 'https://qrisgate.web.id/pay/trx_1' };
    const handler = createHandler({ config, db: { user: async () => ({ id: 'user-1' }), order: async () => order } as never,
      fetchGateway: async () => { throw new Error('gateway offline'); } });
    const response = await handler(request('/status?order_id=' + order.order_id, 'GET', undefined, auth));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'Pending' });
  });

  it('acknowledges a signed webhook ping without a delivery ID, without changing an order', async () => {
    const body = JSON.stringify({ event: 'webhook.ping' });
    const now = String(Math.floor(Date.now() / 1000));
    let applied = false;
    const handler = createHandler({ config, db: { apply: async () => { applied = true; return 'paid'; } } as never, fetchGateway: fetch });
    const headers = { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) };
    const response = await handler(new Request(url + '/webhook', { method: 'POST', headers, body }));
    expect(response.status).toBe(200);
    expect(applied).toBe(false);
    const unsigned = await handler(new Request(url + '/webhook', { method: 'POST', body }));
    expect(unsigned.status).toBe(401);
  });

  it('acknowledges a signed connectivity test without a delivery ID and never applies it', async () => {
    const body = JSON.stringify({ event: 'webhook.test', message: 'ping' });
    const now = String(Math.floor(Date.now() / 1000));
    let applied = false;
    const handler = createHandler({ config, db: { apply: async () => { applied = true; return 'paid'; } } as never, fetchGateway: fetch });
    const response = await handler(new Request(url + '/webhook', {
      method: 'POST', headers: { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) }, body,
    }));
    expect(response.status).toBe(200);
    expect(applied).toBe(false);
  });

  it('acknowledges signed ping without an event name but never treats it as a payment', async () => {
    const body = JSON.stringify({ type: 'ping' });
    const now = String(Math.floor(Date.now() / 1000));
    let applied = false;
    const handler = createHandler({ config, db: { apply: async () => { applied = true; return 'paid'; } } as never, fetchGateway: fetch });
    const response = await handler(new Request(url + '/webhook', {
      method: 'POST', headers: { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) }, body,
    }));
    expect(response.status).toBe(200);
    expect(applied).toBe(false);
  });

  it('acknowledges a signed non-payment probe without touching an order', async () => {
    const body = JSON.stringify({ probe: 'connectivity' });
    // A verified, non-payment payload is a connectivity probe, not an order update.
    const now = String(Math.floor(Date.now() / 1000));
    let applied = false;
    const handler = createHandler({ config, db: { apply: async () => { applied = true; return 'paid'; } } as never, fetchGateway: fetch });
    const response = await handler(new Request(url + '/webhook', {
      method: 'POST', headers: { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) }, body,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(applied).toBe(false);
  });

  it('rejects a payment-looking signed probe with no delivery ID', async () => {
    const body = JSON.stringify({ event: 'webhook.ping', transaction_id: 'trx_1' });
    const now = String(Math.floor(Date.now() / 1000));
    const handler = createHandler({ config, db: {} as never, fetchGateway: fetch });
    const response = await handler(new Request(url + '/webhook', {
      method: 'POST', headers: { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) }, body,
    }));
    expect(response.status).toBe(400);
  });

  it('rejects signed payment events without a delivery ID', async () => {
    const body = JSON.stringify({ event: 'payment.paid', external_order_id: 'qg_12345678-1234-4123-8123-123456789abc', transaction_id: 'trx_1', base_amount: 899000, total_amount: 899007, paid_at: '2026-11-10T00:00:00Z' });
    const now = String(Math.floor(Date.now() / 1000));
    const response = await createHandler({ config, db: {} as never, fetchGateway: fetch })(new Request(url + '/webhook', {
      method: 'POST', headers: { 'x-qrisgate-timestamp': now, 'x-qrisgate-signature': await sign(now, body) }, body,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing delivery ID' });
  });

  it('rejects unsigned webhooks and forwards signed flat payload with delivery id', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { event: 'payment.paid', external_order_id: 'qg_12345678-1234-4123-8123-123456789abc', transaction_id: 'trx_1', base_amount: 899000, total_amount: 899007, paid_at: '2026-11-10T00:00:00Z' };
    const body = JSON.stringify(payload);
    const deliveries: unknown[] = [];
    const handler = createHandler({ config, db: { apply: async (...args: unknown[]) => { deliveries.push(args); return 'paid'; } } as never, fetchGateway: fetch });
    expect((await handler(request('/webhook', 'POST', payload))).status).toBe(401);
    const headers = { 'x-qrisgate-timestamp': String(now), 'x-qrisgate-signature': await sign(String(now), body), 'x-qrisgate-delivery-id': 'delivery-1' };
    const response = await handler(new Request(url + '/webhook', { method: 'POST', headers, body }));
    expect(response.status).toBe(200);
    expect(deliveries[0]).toEqual(['delivery-1', payload]);
  });
});
