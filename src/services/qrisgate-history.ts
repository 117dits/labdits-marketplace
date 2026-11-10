import { supabase } from '@/integrations/supabase/client';

export interface QrisgateHistoryOrder {
  id: string;
  status: string;
  total: number;
  payment_method: string;
  created_at: string;
}

/** Real orders only. Supabase RLS also enforces owner access on the server. */
export async function listQrisgateOrders(): Promise<QrisgateHistoryOrder[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Silakan masuk untuk melihat pesanan.');
  const { data, error } = await supabase.from('orders')
    .select('id,status,total,payment_method,created_at')
    .eq('user_id', user.id)
    .eq('simulated', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
