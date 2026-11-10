import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, from, eq, order } = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), eq: vi.fn(), order: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser }, from } }));

import { listQrisgateOrders } from '@/services/qrisgate-history';

describe('owner-scoped QRISGate history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select: () => ({ eq }) });
    eq.mockReturnValue({ eq, order });
  });

  it('requires an authenticated Supabase user before querying orders', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listQrisgateOrders()).rejects.toThrow('Silakan masuk');
    expect(from).not.toHaveBeenCalled();
  });

  it('queries only real orders owned by the current user, never settings or localStorage', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    order.mockResolvedValue({ data: [{ id: 'qg_123', status: 'Paid', total: 25007, payment_method: 'QRIS', created_at: '2026-11-10T00:00:00Z' }], error: null });
    const result = await listQrisgateOrders();
    expect(from).toHaveBeenCalledWith('orders');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(eq).toHaveBeenCalledWith('simulated', false);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('qg_123');
  });

  it('surfaces query failure rather than reporting a misleading empty history', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    order.mockResolvedValue({ data: null, error: new Error('database unavailable') });
    await expect(listQrisgateOrders()).rejects.toThrow('database unavailable');
  });
});
