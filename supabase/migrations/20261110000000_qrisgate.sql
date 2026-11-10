-- Real payment records are written only by service_role RPCs. Prototype/demo rows stay readable.
create table public.qrisgate_payments (
  order_id text primary key references public.orders(id) on delete cascade,
  transaction_id text unique,
  base_amount bigint not null check (base_amount > 0),
  total_amount bigint,
  unique_code integer,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint qrisgate_amounts_check check (total_amount is null or (unique_code between 1 and 99 and total_amount = base_amount + unique_code))
);
create table public.qrisgate_deliveries (
  delivery_id text primary key,
  order_id text not null references public.orders(id),
  event text not null,
  created_at timestamptz not null default now()
);
create index qrisgate_payments_transaction_idx on public.qrisgate_payments(transaction_id);
alter table public.qrisgate_payments enable row level security;
alter table public.qrisgate_deliveries enable row level security;
revoke all on public.qrisgate_payments, public.qrisgate_deliveries from public, anon, authenticated;
grant all on public.qrisgate_payments, public.qrisgate_deliveries to service_role;
-- Payment provider identifiers and checkout metadata remain server-only.
-- Buyers access a minimal, owner-checked response via the status function.

-- Existing authenticated clients may insert demo orders, but must never create or mutate real ones.
create or replace function public.qrisgate_guard_orders() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) is distinct from 'service_role' and
     ((tg_op = 'INSERT' and (new.simulated = false or new.status in ('Initializing','Pending','Paid','Expired','Cancelled'))) or
      (tg_op = 'UPDATE' and (old.simulated = false or new.simulated = false or new.status in ('Initializing','Pending','Paid','Expired','Cancelled'))) or
      (tg_op = 'DELETE' and old.simulated = false)) then
    raise exception 'Real payment orders are server-managed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger qrisgate_guard_orders before insert or update or delete on public.orders for each row execute function public.qrisgate_guard_orders();

create or replace function public.qrisgate_guard_order_items() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) is distinct from 'service_role' and
     ((tg_op in ('UPDATE','DELETE') and exists(select 1 from public.orders where id=old.order_id and simulated=false)) or
      (tg_op in ('UPDATE','INSERT') and exists(select 1 from public.orders where id=new.order_id and simulated=false))) then
    raise exception 'Real payment items are server-managed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger qrisgate_guard_order_items before insert or update or delete on public.order_items for each row execute function public.qrisgate_guard_order_items();
revoke all on function public.qrisgate_guard_orders(), public.qrisgate_guard_order_items() from public,anon,authenticated;

create or replace function public.qrisgate_reserve(p_user uuid, p_email text, p_cart jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb; v_product public.products%rowtype; v_price_key text; v_price_text text;
  v_price bigint; v_qty integer; v_total bigint := 0; v_order text := 'qg_' || gen_random_uuid()::text;
  v_customer uuid; v_items jsonb := '[]'::jsonb; v_name text; v_phone text; v_method text;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) or
     p_cart is null or jsonb_typeof(p_cart->'items') <> 'array' or
     jsonb_array_length(p_cart->'items') not between 1 and 20 then raise exception 'Invalid cart'; end if;
  v_name := btrim(p_cart->>'customer_name'); v_phone := btrim(p_cart->>'customer_whatsapp'); v_method := p_cart->>'payment_method';
  if length(v_name) not between 1 and 120 or length(v_phone) not between 7 and 25 or v_method not in ('QRIS','BANK_TRANSFER') then raise exception 'Invalid customer'; end if;
  for v_item in select value from jsonb_array_elements(p_cart->'items') loop
    if jsonb_typeof(v_item) <> 'object' or (select count(*) from jsonb_object_keys(v_item)) <> 3 or
      jsonb_typeof(v_item->'quantity') <> 'number' or (v_item->>'quantity') !~ '^[1-9][0-9]*$' or
      length(v_item->>'quantity') > 2 then raise exception 'Invalid item'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty not between 1 and 10 then raise exception 'Invalid quantity'; end if;
    v_price_key := case v_item->>'license' when 'personal' then 'price' when 'commercial' then 'commercialPrice' when 'installation' then 'installationPrice' else null end;
    if v_price_key is null then raise exception 'Invalid license'; end if;
    select * into v_product from public.products where id = v_item->>'productId' and status = 'published';
    if not found then raise exception 'Unavailable product'; end if;
    v_price_text := v_product.data ->> v_price_key;
    if v_price_text is null or v_price_text !~ '^[1-9][0-9]{0,10}$' then raise exception 'Invalid price'; end if;
    v_price := v_price_text::bigint;
    v_total := v_total + v_price * v_qty;
    if v_total > 1000000000 then raise exception 'Amount exceeds limit'; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'license', v_item->>'license', 'quantity', v_qty));
  end loop;
  insert into public.customers(user_id,name,email,whatsapp) values(p_user,v_name,p_email,v_phone)
    on conflict(user_id) do update set name=excluded.name,whatsapp=excluded.whatsapp returning id into v_customer;
  insert into public.orders(id,user_id,customer_id,total,payment_method,status,simulated)
    values(v_order,p_user,v_customer,v_total,v_method,'Initializing',false);
  insert into public.order_items(order_id,product_id,license,quantity)
    select v_order, x->>'product_id', x->>'license', (x->>'quantity')::integer from jsonb_array_elements(v_items) x;
  insert into public.qrisgate_payments(order_id,base_amount) values(v_order,v_total);
  return jsonb_build_object('order_id',v_order,'base_amount',v_total);
end;
$$;
revoke all on function public.qrisgate_reserve(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.qrisgate_reserve(uuid,text,jsonb) to service_role;

create or replace function public.qrisgate_activate(p_order text,p_tx text,p_url text,p_base bigint,p_total bigint,p_code integer,p_expiry timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  update public.qrisgate_payments p set transaction_id=p_tx,checkout_url=p_url,total_amount=p_total,unique_code=p_code,expires_at=p_expiry
    from public.orders o where p.order_id=p_order and o.id=p_order and o.status='Initializing' and p.base_amount=p_base and p_total=p_base+p_code and p_code between 1 and 99;
  if not found then raise exception 'Checkout activation mismatch'; end if;
  update public.orders set status='Pending',total=p_total where id=p_order and status='Initializing';
end;
$$;
revoke all on function public.qrisgate_activate(text,text,text,bigint,bigint,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.qrisgate_activate(text,text,text,bigint,bigint,integer,timestamptz) to service_role;

create or replace function public.qrisgate_fail(p_order text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  update public.orders set status='Failed' where id=p_order and status='Initializing';
end;
$$;
revoke all on function public.qrisgate_fail(text) from public,anon,authenticated;
grant execute on function public.qrisgate_fail(text) to service_role;

create or replace function public.qrisgate_apply(p_delivery text,p_order text,p_tx text,p_event text,p_base bigint,p_total bigint,p_paid_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_payment public.qrisgate_payments%rowtype;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if length(p_delivery) not between 1 and 200 or p_event not in ('payment.paid','payment.expired','payment.cancelled') then raise exception 'Invalid event'; end if;
  select * into v_order from public.orders where id=p_order and simulated=false for update;
  if not found then raise exception 'Unknown order'; end if;
  select * into v_payment from public.qrisgate_payments where order_id=p_order for update;
  if v_payment.transaction_id is distinct from p_tx or v_payment.base_amount is distinct from p_base or
     v_payment.total_amount is distinct from p_total then raise exception 'Payment mismatch'; end if;
  insert into public.qrisgate_deliveries(delivery_id,order_id,event) values(p_delivery,p_order,p_event)
    on conflict (delivery_id) do nothing;
  if not found then return v_order.status; end if;
  -- A provider-confirmed payment may arrive after an expiry/cancellation callback.
  -- Never silently discard money received; later expiry/cancellation cannot undo Paid.
  if p_event='payment.paid' and v_order.status in ('Pending','Expired','Cancelled') then
    if p_paid_at is null then raise exception 'Missing paid_at'; end if;
    update public.orders set status='Paid' where id=p_order;
    update public.qrisgate_payments set paid_at=p_paid_at where order_id=p_order;
    return 'Paid';
  end if;
  if v_order.status <> 'Pending' then return v_order.status; end if;
  update public.orders set status=case when p_event='payment.expired' then 'Expired' else 'Cancelled' end where id=p_order;
  return case when p_event='payment.expired' then 'Expired' else 'Cancelled' end;
end;
$$;
revoke all on function public.qrisgate_apply(text,text,text,text,bigint,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.qrisgate_apply(text,text,text,text,bigint,bigint,timestamptz) to service_role;
