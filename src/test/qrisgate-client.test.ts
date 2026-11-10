import { describe, expect, it, vi, afterEach } from 'vitest';
import { createQrisgateCheckout, getQrisgateOrder } from '@/services/qrisgate-service';

afterEach(() => vi.restoreAllMocks());

describe('QRISGate browser adapter', () => {
  it('requires a real authenticated Supabase session before checkout', async () => {
    await expect(createQrisgateCheckout({ items: [{ productId: 'p1', license: 'personal', quantity: 1 }], customer_name: 'Dits', customer_whatsapp: '08123456789', payment_method: 'QRIS' }, null)).rejects.toThrow(/masuk/i);
  });
  it('sends only item identifiers, quantity and customer info to the server (never browser total)', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ order_id: 'INV-1', checkout_url: 'https://qrisgate.web.id/pay/trx_1', total_amount: 1007, expires_at: new Date().toISOString() }), { status: 201 }));
    const result = await createQrisgateCheckout({ items: [{ productId: 'p1', license: 'personal', quantity: 1 }], customer_name: 'Dits', customer_whatsapp: '08123456789', payment_method: 'QRIS' }, 'test-token', { url: 'https://example.supabase.co', key: 'public-key', fetcher, origin: 'https://labdits.example' });
    expect(result.order_id).toBe('INV-1');
    const call = fetcher.mock.calls.at(0);
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(url).toBe('https://example.supabase.co/functions/v1/qrisgate-api/checkout');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body)).toEqual({ items: [{ productId: 'p1', license: 'personal', quantity: 1 }], customer_name: 'Dits', customer_whatsapp: '08123456789', payment_method: 'QRIS', return_url: 'https://labdits.example/account/orders' });
  });
  it('does not leak gateway credentials when status lookup fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Pesanan tidak ditemukan' }), { status: 404 }));
    await expect(getQrisgateOrder('INV-1', 'test-token', { url: 'https://example.supabase.co', key: 'public-key', fetcher })).rejects.toThrow('Pesanan tidak ditemukan');
    expect(fetcher.mock.calls.at(0)?.[0]).toContain('/status?order_id=INV-1');
  });
});
