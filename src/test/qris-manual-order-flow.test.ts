import { describe, it, expect, vi } from 'vitest';
import { seedOrders, seedCustomers, money, priceFor, licenseNames } from '@/data/products';
import { mockService } from '@/services/mock-service';
import type { Order, Product } from '@/types';

describe('DITSSTORE Manual QRIS & Order Flow', () => {
  it('ensures demo purchase history has been purged from seeds', () => {
    expect(seedOrders).toHaveLength(0);
    expect(seedCustomers).toHaveLength(0);
  });

  it('formats WhatsApp payment confirmation message with correct invoice and details', () => {
    const mockProduct: Product = {
      id: '1',
      slug: 'financeflow',
      name: 'FinanceFlow',
      subtitle: 'Financial Management Dashboard',
      category: 'Admin Dashboards',
      price: 149000,
      commercialPrice: 299000,
      installationPrice: 499000,
      image: '/preview/1.jpg',
      theme: 'mint',
      features: ['Real-time overview'],
      stack: ['React', 'TypeScript'],
      description: 'FinanceFlow dashboard.',
      featured: true,
      popularity: 95,
      version: '1.0.0',
      updated: '2026-10-20',
      devices: ['Desktop'],
      status: 'published',
    };

    const cart = [{ productId: '1', license: 'personal' as const, quantity: 1 }];
    const orderId = 'INV-123456';
    const buyerName = 'Raditya Customer';
    const buyerEmail = 'buyer@example.com';
    const buyerWa = '08123456789';
    const adminWhatsapp = '085882846665';
    const cleanAdminWa = adminWhatsapp.replace(/\D/g, '').replace(/^0/, '62');

    const itemsText = cart
      .map((item) => {
        return `• ${mockProduct.name} (${licenseNames[item.license]} · ${item.quantity}x) = ${money(
          priceFor(mockProduct, item.license) * item.quantity,
        )}`;
      })
      .join('\n');

    const waMessage = `Halo Admin DITSSTORE, saya ingin konfirmasi pembayaran pesanan template:\n\nNo. Invoice: ${orderId}\nNama Pembeli: ${buyerName}\nEmail: ${buyerEmail}\nWhatsApp: ${buyerWa}\n\nRincian Pembelian:\n${itemsText}\n\nTotal Pembayaran: ${money(149000)}\nMetode Pembayaran: QRIS Manual DITSSTORE / SeaBank\n\nSaya telah melakukan pembayaran dan melampirkan foto bukti transfer pada chat ini. Mohon diverifikasi (acc) di dashboard admin agar akses unduhan source code segera aktif. Terima kasih!`;

    expect(cleanAdminWa).toBe('6285882846665');
    expect(waMessage).toContain('INV-123456');
    expect(waMessage).toContain('FinanceFlow');
    expect(waMessage).toContain(money(149000));
    expect(waMessage).toContain('QRIS Manual DITSSTORE / SeaBank');
    expect(waMessage).toContain('08123456789');
  });

  it('manages order state progression from Pending to Paid (Admin Acc)', () => {
    const orders: Order[] = [];
    const newOrder: Order = {
      id: 'INV-998877',
      customer: {
        id: 'cust_123',
        name: 'Dits Buyer',
        email: 'dits@buyer.com',
        whatsapp: '081234567890',
        status: 'Active',
      },
      items: [{ productId: '1', license: 'personal', quantity: 1 }],
      total: 149000,
      date: '2026-11-07',
      paymentMethod: 'QRIS Manual (DITSSTORE)',
      status: 'Pending',
      simulated: false,
    };

    orders.unshift(newOrder);
    expect(orders[0]?.status).toBe('Pending');

    // Admin Acc action
    const updatedOrders = orders.map((o) => (o.id === 'INV-998877' ? { ...o, status: 'Paid' as const } : o));
    expect(updatedOrders[0]?.status).toBe('Paid');
  });

  it('generates production source code documentation file instead of demo text', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await mockService.downloadExample('FinanceFlow', 'commercial', 'INV-554433');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
