import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { navigate, setSession, signInWithPassword, roleQuery } = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSession: vi.fn(),
  signInWithPassword: vi.fn(),
  roleQuery: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>, useNavigate: () => navigate }));
vi.mock('@/hooks/use-marketplace', () => ({ useMarketplace: vi.fn(() => ({ session: null, hydrated: true, setSession })) }));
vi.mock('@/services/catalog-service', () => ({ catalogConfigured: () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { signInWithPassword, signUp: vi.fn() },
  from: () => ({ select: () => ({ eq: roleQuery }) }),
} }));
vi.mock('@/components/layout/dashboard-layout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/admin/admin-pages', () => ({ OrdersTable: () => <div /> }));
vi.mock('@/components/views/qrisgate-history', () => ({ QrisgateHistory: () => <div /> }));

import { Login } from '@/components/views/account';

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Alamat Email'), { target: { value: 'buyer@example.test' } });
  fireEvent.change(screen.getByLabelText('Kata Sandi'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Masuk Sekarang' }));
}

describe('login destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/login');
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1', email: 'buyer@example.test', user_metadata: { name: 'Buyer' } } }, error: null });
  });
  it('establishes admin session before navigating to admin dashboard', async () => {
    roleQuery.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
    render(<Login />);
    submitLogin();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/admin' }));
    expect(setSession).toHaveBeenCalledWith({ name: 'Buyer', email: 'buyer@example.test', role: 'owner' });
    expect(setSession.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]!);
  });
  it('sends non-admin to customer dashboard', async () => {
    roleQuery.mockResolvedValue({ data: [], error: null });
    render(<Login />);
    submitLogin();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/account' }));
    expect(setSession).toHaveBeenCalledWith({ name: 'Buyer', email: 'buyer@example.test', role: 'customer' });
  });
  it('redirects an already authenticated admin away from the login form', async () => {
    roleQuery.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
    // Existing session is provided by the shared MarketplaceProvider on page reload.
    const { useMarketplace } = await import('@/hooks/use-marketplace');
    vi.mocked(useMarketplace).mockReturnValueOnce({ session: { name: 'Admin', email: 'admin@example.test', role: 'owner' }, hydrated: true, setSession } as never);
    render(<Login />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/admin', replace: true }));
  });
  it('does not silently downgrade an admin when role query fails', async () => {
    roleQuery.mockResolvedValue({ data: null, error: new Error('RLS/network failure') });
    render(<Login />);
    submitLogin();
    await waitFor(() => expect(roleQuery).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });
});
