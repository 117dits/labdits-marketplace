import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarketplaceProvider, useMarketplace } from '@/hooks/use-marketplace';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const { auth, catalog } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(),
  },
  catalog: { products: vi.fn(), settings: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth,
    from: (table: string) => ({ select: () => ({ eq: async () => ({ data: table === 'user_roles' ? [{ role: 'admin' }] : [], error: null }) }) }),
  },
}));
vi.mock('@/services/catalog-service', () => ({ catalogConfigured: () => true, createCatalogService: () => catalog }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/components/layout/site-layout', () => ({ Brand: () => <span>LABDITS</span> }));

function SessionView() {
  const { session, hydrated } = useMarketplace();
  return <div data-testid="session">{!hydrated ? 'loading' : session?.role ?? 'none'}</div>;
}

describe('dashboard auth hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'admin@example.test', user_metadata: { name: 'Admin' } } }, error: null });
    catalog.products.mockResolvedValue([]);
    catalog.settings.mockResolvedValue({});
  });
  afterEach(() => vi.clearAllMocks());

  it('shows loading rather than a login prompt while authenticated user is resolving', async () => {
    let resolveUser!: (value: unknown) => void;
    auth.getUser.mockReturnValueOnce(new Promise(resolve => { resolveUser = resolve; }));
    render(<MarketplaceProvider><DashboardLayout owner><p>Admin dashboard loaded</p></DashboardLayout></MarketplaceProvider>);
    expect(screen.queryByText('Area Khusus Administrator')).not.toBeInTheDocument();
    resolveUser({ data: { user: { id: 'u1', email: 'admin@example.test', user_metadata: {} } }, error: null });
    expect(await screen.findByText('Admin dashboard loaded')).toBeInTheDocument();
  });

  it('opens dashboard without waiting for a slow catalog request', async () => {
    catalog.products.mockReturnValueOnce(new Promise(() => {}));
    render(<MarketplaceProvider><DashboardLayout owner><p>Admin dashboard loaded</p></DashboardLayout></MarketplaceProvider>);
    expect(await screen.findByText('Admin dashboard loaded')).toBeInTheDocument();
  });

  it('keeps authenticated admin session even when the catalog fetch fails', async () => {
    catalog.products.mockRejectedValueOnce(new Error('catalog offline'));
    render(<MarketplaceProvider><SessionView /></MarketplaceProvider>);
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('owner'));
  });

  it('ignores stale local demo identity when Supabase has no authenticated user', async () => {
    localStorage.setItem('labdits_customer_session', JSON.stringify({ name: 'Old admin', email: 'old@example.test', role: 'owner' }));
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    render(<MarketplaceProvider><SessionView /></MarketplaceProvider>);
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('none'));
  });
});
