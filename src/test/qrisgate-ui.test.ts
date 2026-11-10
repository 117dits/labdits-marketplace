import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const commerce = readFileSync('src/components/views/commerce.tsx', 'utf8');
const account = readFileSync('src/components/views/account.tsx', 'utf8');
const history = readFileSync('src/components/views/qrisgate-history.tsx', 'utf8');
const marketplace = readFileSync('src/hooks/use-marketplace.tsx', 'utf8');
const historyService = readFileSync('src/services/qrisgate-history.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261020063316_e6453979-c458-4055-aaf0-3efae4a71612.sql', 'utf8');

describe('QRISGate checkout boundaries', () => {
  it('does not allow buyers to mark automatic payments paid from the browser', () => {
    expect(commerce).not.toContain('handleConfirmAutomaticPaid');
    expect(commerce).not.toContain('createPakasirTransaction');
    expect(commerce).toContain('createQrisgateCheckout');
  });
  it('shows owner-scoped server orders in account history without treating them as downloads', () => {
    expect(account).toContain('QrisgateHistory');
    expect(history).toContain('listQrisgateOrders()');
    expect(history).not.toContain('mockService.downloadExample');
  });
  it('does not claim a generated guide is real source code', () => {
    expect(account).not.toContain('Unduh Source Code');
    expect(account).not.toContain('Akses unduhan source code penuh');
    expect(account).toContain('Panduan contoh (demo)');
  });
});
