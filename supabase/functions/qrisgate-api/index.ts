import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { createHandler, type Database } from './logic.ts';

const config = {
  apiKey: Deno.env.get('QRISGATE_API_KEY') || '',
  webhookSecret: Deno.env.get('QRISGATE_WEBHOOK_SECRET') || '',
  supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  allowedOrigin: Deno.env.get('QRISGATE_ALLOWED_ORIGIN') || '',
  returnOrigin: Deno.env.get('QRISGATE_ALLOWED_ORIGIN') || '',
};
// Never send this client or its credentials to a browser. RPCs alone write real orders.
const admin = config.supabaseUrl && config.serviceKey ? createClient(config.supabaseUrl, config.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
function requireAdmin() { if (!admin) throw new Error('Backend not configured'); return admin; }
function result<T>(value: { data: T | null; error: unknown }): T {
  if (value.error || value.data === null) throw new Error('Database operation failed');
  return value.data;
}
const db: Database = {
  async user(token) {
    const { data, error } = await requireAdmin().auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email };
  },
  async reserve(userId, email, cart) {
    return result(await requireAdmin().rpc('qrisgate_reserve', { p_user: userId, p_email: email, p_cart: cart }));
  },
  async activate(orderId, data) {
    const { error } = await requireAdmin().rpc('qrisgate_activate', {
      p_order: orderId, p_tx: data.transaction_id, p_url: data.checkout_url,
      p_base: data.base_amount, p_total: data.total_amount, p_code: data.unique_code, p_expiry: data.expires_at,
    });
    if (error) throw new Error('Activation failed');
  },
  async fail(orderId) {
    const { error } = await requireAdmin().rpc('qrisgate_fail', { p_order: orderId });
    if (error) throw new Error('Failure state update failed');
  },
  async order(orderId, userId) {
    // Explicit ownership check, independent of service-role RLS bypass.
    const { data, error } = await requireAdmin().from('orders')
      .select('id,status,user_id').eq('id', orderId).eq('user_id', userId).eq('simulated', false).maybeSingle();
    if (error) throw new Error('Order lookup failed');
    if (!data) return null;
    const payment = result(await requireAdmin().from('qrisgate_payments')
      .select('base_amount,total_amount,transaction_id,expires_at,checkout_url').eq('order_id', orderId).single());
    return { order_id: data.id, status: data.status, total_amount: Number(payment.total_amount || payment.base_amount),
      base_amount: Number(payment.base_amount), transaction_id: payment.transaction_id, expires_at: payment.expires_at,
      checkout_url: payment.checkout_url };
  },
  async apply(deliveryId, payload) {
    return result(await requireAdmin().rpc('qrisgate_apply', {
      p_delivery: deliveryId, p_order: payload.external_order_id, p_tx: payload.transaction_id,
      p_event: payload.event, p_base: payload.base_amount, p_total: payload.total_amount,
      p_paid_at: payload.paid_at || null,
    }));
  },
};
Deno.serve(createHandler({ config, db, fetchGateway: fetch }));
