-- 草稿 migration：開運商品正式訂單 / 品項 / 收件 / 物流資料表
-- 尚未在 production 執行
-- 第一版目標：正式訂單 + 付款狀態 + 人工出貨
-- 物流 API 第二階段再接

create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null,
  user_id uuid null references auth.users(id) on delete set null,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_amount_twd integer not null,
  payment_method text not null default 'bank_transfer',
  payment_status text not null default 'pending',
  order_status text not null default 'pending_payment',
  shipping_status text not null default 'not_shipped',
  payment_id uuid null references public.payments(id) on delete set null,
  bank_transfer_submission_id uuid null references public.bank_transfer_submissions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_orders_total_amount_twd_check check (total_amount_twd >= 0),
  constraint product_orders_payment_method_check check (payment_method in ('bank_transfer', 'newebpay')),
  constraint product_orders_payment_status_check check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  constraint product_orders_order_status_check check (order_status in ('pending_payment', 'paid', 'preparing', 'shipped', 'completed', 'canceled')),
  constraint product_orders_shipping_status_check check (shipping_status in ('not_shipped', 'preparing', 'shipped', 'delivered', 'failed', 'returned'))
);

create table if not exists public.product_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete cascade,
  product_slug text not null,
  product_name text not null,
  unit_price_twd integer not null,
  quantity integer not null,
  subtotal_twd integer not null,
  product_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint product_order_items_quantity_check check (quantity > 0),
  constraint product_order_items_unit_price_twd_check check (unit_price_twd >= 0),
  constraint product_order_items_subtotal_twd_check check (subtotal_twd >= 0)
);

create table if not exists public.product_shipping_info (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete cascade,
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  shipping_method text not null default 'manual',
  postal_code text,
  address text,
  store_type text,
  store_id text,
  store_name text,
  store_address text,
  store_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_shipping_info_shipping_method_check check (
    shipping_method in ('manual', 'convenience_store_c2c', 'convenience_store_b2c', 'home_delivery')
  )
);

create table if not exists public.product_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete cascade,
  provider text not null default 'manual',
  logistics_type text,
  ship_type text,
  trade_type text,
  merchant_order_no text,
  lgs_no text,
  store_print_no text,
  shipment_status text not null default 'pending',
  ret_id text,
  ret_string text,
  event_time timestamptz,
  printed_at timestamptz,
  shipped_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_shipments_provider_check check (provider in ('manual', 'newebpay_logistics')),
  constraint product_shipments_shipment_status_check check (
    shipment_status in ('pending', 'created', 'printed', 'shipped', 'delivered', 'failed', 'returned', 'canceled')
  )
);

create unique index if not exists product_orders_order_no_idx
on public.product_orders(order_no);

create index if not exists product_orders_user_id_created_at_idx
on public.product_orders(user_id, created_at desc);

create index if not exists product_orders_payment_status_idx
on public.product_orders(payment_status);

create index if not exists product_orders_order_status_idx
on public.product_orders(order_status);

create index if not exists product_orders_shipping_status_idx
on public.product_orders(shipping_status);

create index if not exists product_orders_payment_id_idx
on public.product_orders(payment_id);

create index if not exists product_orders_bank_transfer_submission_id_idx
on public.product_orders(bank_transfer_submission_id);

create index if not exists product_order_items_order_id_idx
on public.product_order_items(order_id);

create index if not exists product_order_items_product_slug_idx
on public.product_order_items(product_slug);

create unique index if not exists product_shipping_info_order_id_idx
on public.product_shipping_info(order_id);

create index if not exists product_shipping_info_shipping_method_idx
on public.product_shipping_info(shipping_method);

create index if not exists product_shipping_info_store_id_idx
on public.product_shipping_info(store_id);

create index if not exists product_shipments_order_id_idx
on public.product_shipments(order_id);

create index if not exists product_shipments_provider_idx
on public.product_shipments(provider);

create index if not exists product_shipments_merchant_order_no_idx
on public.product_shipments(merchant_order_no);

create index if not exists product_shipments_lgs_no_idx
on public.product_shipments(lgs_no);

create index if not exists product_shipments_shipment_status_idx
on public.product_shipments(shipment_status);

alter table public.product_orders enable row level security;
alter table public.product_order_items enable row level security;
alter table public.product_shipping_info enable row level security;
alter table public.product_shipments enable row level security;

grant select, insert, update
on table public.product_orders
to service_role;

grant select, insert, update
on table public.product_order_items
to service_role;

grant select, insert, update
on table public.product_shipping_info
to service_role;

grant select, insert, update
on table public.product_shipments
to service_role;
