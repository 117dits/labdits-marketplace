import { describe, expect, it, vi } from 'vitest';
import { getDeploymentAuthHeaders } from '@/services/deployment-service';

describe('deployment API authentication', () => {
  it('uses the signed-in user access token, not the public key, for remote deploys', async () => {
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-jwt' } }, error: null })) } };
    expect(await getDeploymentAuthHeaders(false, client as never, 'publishable-key')).toEqual({
      apikey: 'publishable-key',
      Authorization: 'Bearer user-jwt',
    });
  });
  it('rejects a remote deployment without an authenticated session', async () => {
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } };
    await expect(getDeploymentAuthHeaders(false, client as never, 'publishable-key')).rejects.toThrow('Sign in');
  });
  it('keeps the local deployment adapter free of Supabase auth headers', async () => {
    const client = { auth: { getSession: vi.fn() } };
    expect(await getDeploymentAuthHeaders(true, client as never, 'publishable-key')).toEqual({});
    expect(client.auth.getSession).not.toHaveBeenCalled();
  });
});
