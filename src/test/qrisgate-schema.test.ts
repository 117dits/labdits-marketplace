import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20261110000000_qrisgate.sql', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

describe('payment function deployment configuration', () => {
  it('lets signed provider webhooks reach the handler without a platform JWT', () => {
    expect(config).toMatch(/\[functions\.qrisgate-api\]\s*verify_jwt\s*=\s*false/i);
  });
});
describe('payment database boundaries', () => {
  it('prices published products inside atomic reservation and restricts writes to service role', () => {
    expect(sql).toMatch(/create or replace function public\.qrisgate_reserve/i);
    expect(sql).toMatch(/status\s*=\s*'published'/i);
    expect(sql).toMatch(/data\s*->>\s*v_price_key/i);
    expect(sql).toMatch(/revoke all on function public\.qrisgate_reserve.*?from public, anon, authenticated/is);
    expect(sql).toMatch(/grant execute on function public\.qrisgate_reserve.*?to service_role/is);
    expect(sql).toMatch(/create trigger .*orders.*before (?:insert or update|update or insert)/is);
    expect(sql).toMatch(/tg_op = 'DELETE'/i);
    expect(sql).toMatch(/create trigger .*order_items.*before (?:insert or update or delete|insert or delete or update)/is);
  });
  it('atomically deduplicates deliveries and lets verified paid events supersede expiry', () => {
    expect(sql).toMatch(/delivery_id text primary key/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/on conflict \(delivery_id\) do nothing/i);
    expect(sql).toMatch(/p_event='payment\.paid' and v_order\.status in \('Pending','Expired','Cancelled'\)/i);
    expect(sql.indexOf("p_event='payment.paid' and v_order.status")).toBeLessThan(sql.indexOf("if v_order.status <> 'Pending'"));
  });
  it('keeps provider payment records inaccessible to browser roles', () => {
    expect(sql).toMatch(/revoke all on public\.qrisgate_payments, public\.qrisgate_deliveries from public, anon, authenticated/i);
    expect(sql).not.toMatch(/grant select on public\.qrisgate_payments to authenticated/i);
  });
});
