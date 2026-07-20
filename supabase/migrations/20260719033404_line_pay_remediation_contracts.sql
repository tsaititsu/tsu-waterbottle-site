-- LINE Pay remediation PR1: database-only contracts.
-- This migration does not enable checkout or call any external service.

begin;

-- This migration is the first and only creator of the public LINE Pay RPCs
-- below. Any pre-existing same-name function (including an otherwise-looking
-- compatible signature) is an unknown overload and must be reviewed instead
-- of being replaced or left callable.
do $$
declare
  v_unexpected_inventory text;
begin
  select pg_catalog.string_agg(
    pg_catalog.format(
      '%I(%s)|owner=%I|security_definer=%s|config=%s|acl=%s',
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid),
      owner.rolname,
      procedure.prosecdef,
      coalesce(procedure.proconfig::text, 'null'),
      coalesce(procedure.proacl::text, 'default')
    ),
    ';' order by procedure.proname, procedure.proargtypes::text
  )
  into v_unexpected_inventory
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_roles as owner
    on owner.oid = procedure.proowner
  where namespace.nspname = 'public'
    and procedure.proname = any (array[
      'claim_product_order_line_pay_request',
      'record_product_order_line_pay_request_success',
      'record_product_order_line_pay_request_failure',
      'mark_product_order_line_pay_request_unknown',
      'read_product_order_line_pay_request_result',
      'claim_line_pay_callback_capability',
      'claim_product_order_line_pay_confirmation',
      'record_product_order_line_pay_confirmation_evidence',
      'complete_product_order_line_pay_confirmation',
      'cancel_product_order_line_pay_payment',
      'mark_product_order_line_pay_reconciliation'
    ]::text[]);

  if v_unexpected_inventory is not null then
    raise exception using
      errcode = '42710',
      message = 'line_pay_sensitive_rpc_preexisting_overload',
      detail = v_unexpected_inventory;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.payments') is null then
    raise exception using
      errcode = '42P01',
      message = 'line_pay_contracts_missing_payments_table';
  end if;

  if to_regclass('public.product_orders') is null then
    raise exception using
      errcode = '42P01',
      message = 'line_pay_contracts_missing_product_orders_table';
  end if;
end
$$;

-- Guard every same-name constraint type before any side-effect DDL. The
-- legacy CHECK definition is taken from the reviewed base schema.
-- pg_get_constraintdef provides a canonical deparse; whitespace and case are
-- normalized deterministically before an exact allowlist comparison.
do $$
declare
  v_relation_oid oid := pg_catalog.to_regclass('public.product_orders');
  v_constraint_count bigint;
  v_constraint_type text;
  v_constraint_definition text;
  v_normalized_definition text;
  v_constraint_metadata_valid boolean;
begin
  -- line_pay_constraint_guard:all_same_name_types
  select pg_catalog.count(*)
  into v_constraint_count
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = v_relation_oid
    and constraint_row.conname = 'product_orders_payment_method_check';

  if v_constraint_count > 1 then
    raise exception using
      errcode = '42710',
      message = 'product_orders_payment_method_constraint_duplicate_name_conflict',
      detail = pg_catalog.format('count=%s', v_constraint_count);
  end if;

  if v_constraint_count = 1 then
    select
      constraint_row.contype::text,
      pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
      constraint_row.convalidated
        and not constraint_row.connoinherit
        and not constraint_row.condeferrable
        and not constraint_row.condeferred
        and constraint_row.conislocal
        and constraint_row.coninhcount = 0
        and constraint_row.conparentid = 0
        and constraint_row.contypid = 0
        and constraint_row.connamespace = relation.relnamespace
    into
      v_constraint_type,
      v_constraint_definition,
      v_constraint_metadata_valid
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as relation
      on relation.oid = constraint_row.conrelid
    where constraint_row.conrelid = v_relation_oid
      and constraint_row.conname = 'product_orders_payment_method_check';

    if v_constraint_type is distinct from 'c' then
      raise exception using
        errcode = '42809',
        message = 'product_orders_payment_method_constraint_type_conflict',
        detail = pg_catalog.format('contype=%s', coalesce(v_constraint_type, '<null>'));
    end if;

    if v_constraint_metadata_valid is distinct from true then
      raise exception using
        errcode = '23514',
        message = 'product_orders_payment_method_constraint_metadata_conflict';
    end if;

    v_normalized_definition := pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(v_constraint_definition),
        '[[:space:]]+',
        '',
        'g'
      )
    );

    if v_normalized_definition <> 'check((payment_method=any(array[''bank_transfer''::text,''newebpay''::text])))'
       and v_normalized_definition <> 'check((payment_method=any(array[''bank_transfer''::text,''newebpay''::text,''line_pay''::text])))' then
      raise exception using
        errcode = '23514',
        message = 'product_orders_payment_method_constraint_definition_conflict',
        detail = v_normalized_definition;
    end if;
  end if;
end
$$;

-- Default ACLs must be rejected before this migration creates any object;
-- otherwise they could materialize as relation/function grants and obscure the
-- original privilege conflict before the complete role inventory runs.
do $$
declare
  v_role_name text;
  v_role_oid oid;
begin
  foreach v_role_name in array array[
    'line_pay_payment_executor',
    'line_pay_payment_function_owner'
  ]::text[] loop
    select role.oid into v_role_oid
    from pg_catalog.pg_roles as role
    where role.rolname = v_role_name;

    if v_role_oid is not null and exists (
      select 1
      from pg_catalog.pg_default_acl as default_acl
      where default_acl.defaclrole = v_role_oid
         or exists (
           select 1
           from pg_catalog.aclexplode(default_acl.defaclacl) as acl
           where acl.grantee = v_role_oid
         )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_default_privilege_conflict';
    end if;
  end loop;
end
$$;

create or replace function public.line_pay_sanitized_result_is_valid(p_payload jsonb)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select
    p_payload is not null
    and pg_catalog.jsonb_typeof(p_payload) = 'object'
    and pg_catalog.octet_length(p_payload::text) <= 2048
    and p_payload::text !~* '(authorization|signature|secret|channel[^[:alnum:]]*id|gateway[^[:alnum:]]*key|cookie|token|email|phone|address|card|trade[^[:alnum:]]*(info|sha)|hash[^[:alnum:]]*(key|iv)|payment[^[:alnum:]]*url|fake_test_token_do_not_use|fake_test_signature_do_not_use|fake_test_authorization_do_not_use)'
    and p_payload ? 'result_code'
    and p_payload ? 'transaction_id'
    and p_payload ? 'merchant_order_no'
    and p_payload ? 'response_sha256'
    and pg_catalog.jsonb_typeof(p_payload -> 'result_code') = 'string'
    and p_payload ->> 'result_code' = '0000'
    and pg_catalog.jsonb_typeof(p_payload -> 'transaction_id') = 'string'
    and p_payload ->> 'transaction_id' ~ '^[A-Za-z0-9_:-]{1,128}$'
    and pg_catalog.jsonb_typeof(p_payload -> 'merchant_order_no') = 'string'
    and p_payload ->> 'merchant_order_no' ~ '^[A-Za-z0-9_:-]{1,100}$'
    and pg_catalog.jsonb_typeof(p_payload -> 'response_sha256') = 'string'
    and p_payload ->> 'response_sha256' ~ '^[0-9a-f]{64}$'
    and (
      not (p_payload ? 'provider_status')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'provider_status') = 'string'
        and p_payload ->> 'provider_status' = 'success'
      )
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_each(p_payload) as entry(key, value)
      where not (entry.key = any (array[
        'result_code',
        'provider_status',
        'transaction_id',
        'merchant_order_no',
        'response_sha256'
      ]::text[]))
        or pg_catalog.jsonb_typeof(entry.value) <> 'string'
    );
$$;

create or replace function public.line_pay_audit_evidence_is_valid(p_payload jsonb)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select
    p_payload is not null
    and pg_catalog.jsonb_typeof(p_payload) = 'object'
    and pg_catalog.octet_length(p_payload::text) <= 4096
    and p_payload::text !~* '(authorization|signature|secret|channel[^[:alnum:]]*id|gateway[^[:alnum:]]*key|cookie|token|email|phone|address|card|trade[^[:alnum:]]*(info|sha)|hash[^[:alnum:]]*(key|iv)|request[^[:alnum:]]*body|response[^[:alnum:]]*body|payment[^[:alnum:]]*url|fake_test_token_do_not_use|fake_test_signature_do_not_use|fake_test_authorization_do_not_use)'
    and (
      not (p_payload ? 'result_code')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'result_code') = 'string'
        and p_payload ->> 'result_code' = any (array[
          '0000',
          'claimed',
          'verified',
          'already_paid',
          'cancel_after_paid',
          'canceled',
          'failed',
          'unknown',
          'reconciliation_required'
        ]::text[])
      )
    )
    and (
      not (p_payload ? 'provider_status')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'provider_status') = 'string'
        and p_payload ->> 'provider_status' = any (array[
          'success',
          'pending',
          'failed',
          'canceled',
          'unknown',
          'timeout',
          'reconciliation_required'
        ]::text[])
      )
    )
    and (
      not (p_payload ? 'evidence_sha256')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'evidence_sha256') = 'string'
        and p_payload ->> 'evidence_sha256' ~ '^[0-9a-f]{64}$'
      )
    )
    and (
      not (p_payload ? 'result_sha256')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'result_sha256') = 'string'
        and p_payload ->> 'result_sha256' ~ '^[0-9a-f]{64}$'
      )
    )
    and (
      not (p_payload ? 'reason_code')
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'reason_code') = 'string'
        and p_payload ->> 'reason_code' ~ '^[a-z0-9_:-]{1,64}$'
        and p_payload ->> 'reason_code' !~* '(authorization|signature|secret|cookie|token|email|phone|address|card|trade(info|sha)|hash(key|iv))'
      )
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_each_text(p_payload) as identifier(key, value)
      where identifier.key = any (array[
        'payment_id',
        'product_order_id',
        'checkout_attempt_id',
        'callback_event_id',
        'capability_id'
      ]::text[])
        and identifier.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    and (
      not (p_payload ? 'environment')
      or p_payload ->> 'environment' = any (array['sandbox', 'production']::text[])
    )
    and (
      not (p_payload ? 'merchant_order_no')
      or p_payload ->> 'merchant_order_no' ~ '^[A-Za-z0-9_:-]{1,100}$'
    )
    and (
      not (p_payload ? 'transaction_id')
      or p_payload ->> 'transaction_id' ~ '^[A-Za-z0-9_:-]{1,128}$'
    )
    and (
      not (p_payload ? 'amount_twd')
      or p_payload ->> 'amount_twd' ~ '^[1-9][0-9]*$'
    )
    and (
      not (p_payload ? 'currency')
      or p_payload ->> 'currency' = 'TWD'
    )
    and (
      not (p_payload ? 'event_type')
      or p_payload ->> 'event_type' = any (array[
        'cancel_after_paid',
        'payment_canceled',
        'reconciliation_required'
      ]::text[])
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_each_text(p_payload) as state_value(key, value)
      where state_value.key = any (array['from_state', 'to_state', 'request_state']::text[])
        and state_value.value !~ '^[a-z0-9_:-]{1,64}$'
    )
    and (
      not (p_payload ? 'reconciliation_required')
      or p_payload ->> 'reconciliation_required' = any (array['true', 'false']::text[])
    )
    and (
      not (p_payload ? 'event_timestamp')
      or p_payload ->> 'event_timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9:.+-]+$'
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_each(p_payload) as entry(key, value)
      where not (entry.key = any (array[
        'result_code',
        'provider_status',
        'evidence_sha256',
        'result_sha256',
        'reason_code',
        'payment_id',
        'product_order_id',
        'checkout_attempt_id',
        'callback_event_id',
        'capability_id',
        'environment',
        'merchant_order_no',
        'transaction_id',
        'amount_twd',
        'currency',
        'event_type',
        'from_state',
        'to_state',
        'request_state',
        'reconciliation_required',
        'event_timestamp'
      ]::text[]))
        or pg_catalog.jsonb_typeof(entry.value) <> 'string'
    );
$$;

alter table public.product_orders
  add column if not exists environment text,
  add column if not exists fulfillment_mode text,
  add column if not exists sandbox_test boolean,
  add column if not exists currency text,
  add column if not exists checkout_attempt_id uuid,
  add column if not exists payment_request_state text,
  add column if not exists reconciliation_required boolean,
  add column if not exists state_version integer;

-- Existing rows are production history. They are classified explicitly without
-- changing payment provider, payment method, or any paid/order state.
update public.product_orders
set environment = 'production'
where environment is null;

update public.product_orders
set fulfillment_mode = 'physical'
where fulfillment_mode is null;

update public.product_orders
set sandbox_test = false
where sandbox_test is null;

update public.product_orders
set currency = 'TWD'
where currency is null;

update public.product_orders
set reconciliation_required = false
where reconciliation_required is null;

update public.product_orders
set state_version = 0
where state_version is null;

alter table public.product_orders
  alter column environment set default 'production',
  alter column fulfillment_mode set default 'physical',
  alter column sandbox_test set default false,
  alter column currency set default 'TWD',
  alter column reconciliation_required set default false,
  alter column state_version set default 0;

alter table public.product_orders
  add constraint product_orders_environment_not_null_check
  check (environment is not null) not valid,
  add constraint product_orders_fulfillment_mode_not_null_check
  check (fulfillment_mode is not null) not valid,
  add constraint product_orders_sandbox_test_not_null_check
  check (sandbox_test is not null) not valid,
  add constraint product_orders_currency_not_null_check
  check (currency is not null) not valid,
  add constraint product_orders_reconciliation_not_null_check
  check (reconciliation_required is not null) not valid,
  add constraint product_orders_state_version_not_null_check
  check (state_version is not null) not valid;

alter table public.product_orders
  validate constraint product_orders_environment_not_null_check;
alter table public.product_orders
  validate constraint product_orders_fulfillment_mode_not_null_check;
alter table public.product_orders
  validate constraint product_orders_sandbox_test_not_null_check;
alter table public.product_orders
  validate constraint product_orders_currency_not_null_check;
alter table public.product_orders
  validate constraint product_orders_reconciliation_not_null_check;
alter table public.product_orders
  validate constraint product_orders_state_version_not_null_check;

alter table public.product_orders
  alter column environment set not null,
  alter column fulfillment_mode set not null,
  alter column sandbox_test set not null,
  alter column currency set not null,
  alter column reconciliation_required set not null,
  alter column state_version set not null;

alter table public.product_orders
  drop constraint product_orders_environment_not_null_check,
  drop constraint product_orders_fulfillment_mode_not_null_check,
  drop constraint product_orders_sandbox_test_not_null_check,
  drop constraint product_orders_currency_not_null_check,
  drop constraint product_orders_reconciliation_not_null_check,
  drop constraint product_orders_state_version_not_null_check;

alter table public.product_orders
  drop constraint if exists product_orders_payment_method_check,
  drop constraint if exists product_orders_order_status_check,
  drop constraint if exists product_orders_shipping_status_check;

alter table public.product_orders
  add constraint product_orders_payment_method_check
  check (payment_method in ('bank_transfer', 'newebpay', 'line_pay')) not valid,
  add constraint product_orders_order_status_check
  check (order_status in (
    'pending_payment',
    'payment_requesting',
    'payment_pending',
    'paid',
    'payment_failed',
    'preparing',
    'shipped',
    'completed',
    'canceled'
  )) not valid,
  add constraint product_orders_shipping_status_check
  check (shipping_status in (
    'not_shipped',
    'not_applicable',
    'preparing',
    'shipped',
    'delivered',
    'failed',
    'returned'
  )) not valid,
  add constraint product_orders_environment_check
  check (environment in ('sandbox', 'production')) not valid,
  add constraint product_orders_fulfillment_mode_check
  check (fulfillment_mode in ('physical', 'none')) not valid,
  add constraint product_orders_currency_check
  check (currency = 'TWD') not valid,
  add constraint product_orders_payment_request_state_check
  check (
    payment_request_state is null
    or payment_request_state in (
      'initialized',
      'requesting',
      'pending',
      'confirmation_processing',
      'paid',
      'failed',
      'canceled',
      'reconciliation_required'
    )
  ) not valid,
  add constraint product_orders_state_version_check
  check (state_version >= 0) not valid,
  add constraint product_orders_line_pay_owner_check
  check (payment_method <> 'line_pay' or user_id is not null) not valid,
  add constraint product_orders_line_pay_environment_check
  check (
    payment_method <> 'line_pay'
    or (
      environment in ('sandbox', 'production')
      and (
        environment <> 'sandbox'
        or (
          checkout_attempt_id is not null
          and payment_request_state is not null
        )
      )
    )
  ) not valid,
  add constraint product_orders_sandbox_fulfillment_check
  check (
    not sandbox_test
    or (
      environment = 'sandbox'
      and payment_method = 'line_pay'
      and user_id is not null
      and fulfillment_mode = 'none'
      and shipping_status = 'not_applicable'
      and order_status not in ('preparing', 'shipped', 'completed')
    )
  ) not valid,
  add constraint product_orders_line_pay_reconciliation_check
  check (
    not reconciliation_required
    or payment_method = 'line_pay'
  ) not valid;

alter table public.product_orders validate constraint product_orders_payment_method_check;
alter table public.product_orders validate constraint product_orders_order_status_check;
alter table public.product_orders validate constraint product_orders_shipping_status_check;
alter table public.product_orders validate constraint product_orders_environment_check;
alter table public.product_orders validate constraint product_orders_fulfillment_mode_check;
alter table public.product_orders validate constraint product_orders_currency_check;
alter table public.product_orders validate constraint product_orders_payment_request_state_check;
alter table public.product_orders validate constraint product_orders_state_version_check;
alter table public.product_orders validate constraint product_orders_line_pay_owner_check;
alter table public.product_orders validate constraint product_orders_line_pay_environment_check;
alter table public.product_orders validate constraint product_orders_sandbox_fulfillment_check;
alter table public.product_orders validate constraint product_orders_line_pay_reconciliation_check;

alter table public.payments
  add column if not exists product_order_id uuid,
  add column if not exists environment text,
  add column if not exists checkout_attempt_id uuid,
  add column if not exists request_state text,
  add column if not exists request_idempotency_key text,
  add column if not exists request_body_sha256 text,
  add column if not exists line_pay_transaction_id text,
  add column if not exists reconciliation_required boolean,
  add column if not exists state_version integer;

update public.payments
set environment = 'production'
where environment is null;

update public.payments
set reconciliation_required = false
where reconciliation_required is null;

update public.payments
set state_version = 0
where state_version is null;

alter table public.payments
  alter column environment set default 'production',
  alter column reconciliation_required set default false,
  alter column state_version set default 0;

alter table public.payments
  add constraint payments_environment_not_null_check
  check (environment is not null) not valid,
  add constraint payments_reconciliation_not_null_check
  check (reconciliation_required is not null) not valid,
  add constraint payments_state_version_not_null_check
  check (state_version is not null) not valid;

alter table public.payments validate constraint payments_environment_not_null_check;
alter table public.payments validate constraint payments_reconciliation_not_null_check;
alter table public.payments validate constraint payments_state_version_not_null_check;

alter table public.payments
  alter column environment set not null,
  alter column reconciliation_required set not null,
  alter column state_version set not null;

alter table public.payments
  drop constraint payments_environment_not_null_check,
  drop constraint payments_reconciliation_not_null_check,
  drop constraint payments_state_version_not_null_check;

alter table public.payments
  add constraint payments_product_order_id_fkey
  foreign key (product_order_id)
  references public.product_orders(id)
  on delete restrict
  deferrable initially deferred
  not valid,
  add constraint payments_environment_check
  check (environment in ('sandbox', 'production')) not valid,
  add constraint payments_request_state_check
  check (
    request_state is null
    or request_state in (
      'initialized',
      'requesting',
      'pending',
      'confirmation_processing',
      'paid',
      'failed',
      'canceled',
      'reconciliation_required'
    )
  ) not valid,
  add constraint payments_request_body_sha256_check
  check (
    request_body_sha256 is null
    or request_body_sha256 ~ '^[0-9a-f]{64}$'
  ) not valid,
  add constraint payments_request_idempotency_key_check
  check (
    request_idempotency_key is null
    or (
      pg_catalog.length(request_idempotency_key) between 16 and 200
      and request_idempotency_key !~ '[[:space:]]'
    )
  ) not valid,
  add constraint payments_line_pay_transaction_id_check
  check (
    line_pay_transaction_id is null
    or (
      pg_catalog.length(line_pay_transaction_id) between 1 and 128
      and line_pay_transaction_id !~ '[[:space:]]'
    )
  ) not valid,
  add constraint payments_state_version_check
  check (state_version >= 0) not valid,
  add constraint payments_line_pay_contract_check
  check (
    provider <> 'line_pay'
    or (
      user_id is not null
      and product_order_id is not null
      and checkout_attempt_id is not null
      and environment in ('sandbox', 'production')
      and currency = 'TWD'
      and request_state is not null
      and request_idempotency_key is not null
      and request_body_sha256 is not null
    )
  ) not valid,
  add constraint payments_line_pay_reconciliation_check
  check (
    not reconciliation_required
    or provider = 'line_pay'
  ) not valid;

alter table public.payments validate constraint payments_product_order_id_fkey;
alter table public.payments validate constraint payments_environment_check;
alter table public.payments validate constraint payments_request_state_check;
alter table public.payments validate constraint payments_request_body_sha256_check;
alter table public.payments validate constraint payments_request_idempotency_key_check;
alter table public.payments validate constraint payments_line_pay_transaction_id_check;
alter table public.payments validate constraint payments_state_version_check;
alter table public.payments validate constraint payments_line_pay_contract_check;
alter table public.payments validate constraint payments_line_pay_reconciliation_check;

create table public.app_environment_attestation (
  id boolean primary key default true,
  environment text not null,
  supabase_project_ref text not null,
  schema_contract_version text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint app_environment_attestation_singleton_check check (id),
  constraint app_environment_attestation_environment_check
    check (environment in ('sandbox', 'production')),
  constraint app_environment_attestation_project_ref_check
    check (supabase_project_ref ~ '^[a-z0-9]{8,32}$'),
  constraint app_environment_attestation_version_check
    check (schema_contract_version = 'line_pay_remediation_v1')
);

create table public.line_pay_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_order_id uuid not null references public.product_orders(id) on delete restrict deferrable initially deferred,
  payment_id uuid null references public.payments(id) on delete restrict deferrable initially deferred,
  provider text not null default 'line_pay',
  environment text not null,
  idempotency_key text not null,
  request_body_sha256 text not null,
  request_state text not null default 'initialized',
  amount_twd integer not null,
  currency text not null default 'TWD',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  claim_id uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  upstream_transaction_id text null,
  merchant_order_no text not null,
  sanitized_result jsonb null,
  last_error_code text null,
  reconciliation_required boolean not null default false,
  state_version integer not null default 0,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz null,
  constraint line_pay_checkout_attempts_provider_check
    check (provider = 'line_pay'),
  constraint line_pay_checkout_attempts_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_checkout_attempts_idempotency_key_check
    check (
      pg_catalog.length(idempotency_key) between 16 and 200
      and idempotency_key !~ '[[:space:]]'
    ),
  constraint line_pay_checkout_attempts_request_body_sha256_check
    check (request_body_sha256 ~ '^[0-9a-f]{64}$'),
  constraint line_pay_checkout_attempts_request_state_check
    check (request_state in (
      'initialized',
      'queued',
      'claimed',
      'requesting',
      'pending',
      'succeeded',
      'failed',
      'unknown',
      'reconciliation_required',
      'confirmation_processing',
      'paid',
      'canceled'
    )),
  constraint line_pay_checkout_attempts_amount_check
    check (amount_twd > 0),
  constraint line_pay_checkout_attempts_currency_check
    check (currency = 'TWD'),
  constraint line_pay_checkout_attempts_attempt_count_check
    check (attempt_count >= 0),
  constraint line_pay_checkout_attempts_claim_check
    check (
      (claim_id is null and claimed_at is null and claim_expires_at is null)
      or (
        claim_id is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and claim_expires_at > claimed_at
      )
    ),
  constraint line_pay_checkout_attempts_transaction_id_check
    check (
      upstream_transaction_id is null
      or (
        pg_catalog.length(upstream_transaction_id) between 1 and 128
        and upstream_transaction_id !~ '[[:space:]]'
      )
    ),
  constraint line_pay_checkout_attempts_merchant_order_no_check
    check (
      pg_catalog.length(merchant_order_no) between 1 and 100
      and merchant_order_no !~ '[[:space:]]'
    ),
  constraint line_pay_checkout_attempts_sanitized_result_check
    check (
      sanitized_result is null
      or public.line_pay_sanitized_result_is_valid(sanitized_result)
    ),
  constraint line_pay_checkout_attempts_error_code_check
    check (
      last_error_code is null
      or (
        pg_catalog.length(last_error_code) between 1 and 64
        and last_error_code ~ '^[a-z0-9_:-]+$'
        and last_error_code !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      )
    ),
  constraint line_pay_checkout_attempts_reconciliation_check
    check (
      not reconciliation_required
      or request_state in ('unknown', 'reconciliation_required', 'paid', 'canceled')
    ),
  constraint line_pay_checkout_attempts_state_version_check
    check (state_version >= 0)
);

create table public.line_pay_request_outbox (
  id uuid primary key default gen_random_uuid(),
  checkout_attempt_id uuid not null references public.line_pay_checkout_attempts(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider text not null default 'line_pay',
  environment text not null,
  operation text not null default 'request',
  idempotency_key text not null,
  request_body_sha256 text not null,
  state text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  claim_id uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  last_error_code text null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz null,
  constraint line_pay_request_outbox_provider_check check (provider = 'line_pay'),
  constraint line_pay_request_outbox_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_request_outbox_operation_check check (operation = 'request'),
  constraint line_pay_request_outbox_idempotency_key_check
    check (
      pg_catalog.length(idempotency_key) between 16 and 200
      and idempotency_key !~ '[[:space:]]'
    ),
  constraint line_pay_request_outbox_body_sha256_check
    check (request_body_sha256 ~ '^[0-9a-f]{64}$'),
  constraint line_pay_request_outbox_state_check
    check (state in (
      'queued',
      'claimed',
      'completed',
      'failed',
      'unknown',
      'reconciliation_required',
      'canceled'
    )),
  constraint line_pay_request_outbox_attempt_count_check check (attempt_count >= 0),
  constraint line_pay_request_outbox_claim_check
    check (
      (claim_id is null and claimed_at is null and claim_expires_at is null)
      or (
        claim_id is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and claim_expires_at > claimed_at
      )
    ),
  constraint line_pay_request_outbox_error_code_check
    check (
      last_error_code is null
      or (
        pg_catalog.length(last_error_code) between 1 and 64
        and last_error_code ~ '^[a-z0-9_:-]+$'
        and last_error_code !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      )
    )
);

create table public.line_pay_callback_capabilities (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  product_order_id uuid not null references public.product_orders(id) on delete restrict,
  checkout_attempt_id uuid not null references public.line_pay_checkout_attempts(id) on delete restrict,
  environment text not null,
  purpose text not null,
  token_hash text not null,
  capability_version integer not null default 1,
  claim_id uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint line_pay_callback_capabilities_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_callback_capabilities_purpose_check
    check (purpose in ('confirm', 'cancel')),
  constraint line_pay_callback_capabilities_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint line_pay_callback_capabilities_version_check
    check (capability_version > 0),
  constraint line_pay_callback_capabilities_expiry_check
    check (expires_at > created_at),
  constraint line_pay_callback_capabilities_claim_check
    check (
      (claim_id is null and claimed_at is null and claim_expires_at is null)
      or (
        claim_id is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and claim_expires_at > claimed_at
      )
    ),
  constraint line_pay_callback_capabilities_consumed_check
    check (consumed_at is null or consumed_at >= created_at),
  constraint line_pay_callback_capabilities_revoked_check
    check (revoked_at is null or revoked_at >= created_at)
);

create table public.line_pay_callback_events (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references public.line_pay_callback_capabilities(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  product_order_id uuid not null references public.product_orders(id) on delete restrict,
  checkout_attempt_id uuid not null references public.line_pay_checkout_attempts(id) on delete restrict,
  environment text not null,
  purpose text not null,
  state text not null default 'received',
  claim_id uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  provider_result_sha256 text null,
  safe_result_code text null,
  last_error_code text null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz null,
  constraint line_pay_callback_events_capability_key unique (capability_id),
  constraint line_pay_callback_events_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_callback_events_purpose_check
    check (purpose in ('confirm', 'cancel')),
  constraint line_pay_callback_events_state_check
    check (state in (
      'received',
      'claimed',
      'provider_verified',
      'completed',
      'failed',
      'reconciliation_required'
    )),
  constraint line_pay_callback_events_claim_check
    check (
      (claim_id is null and claimed_at is null and claim_expires_at is null)
      or (
        claim_id is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and claim_expires_at > claimed_at
      )
    ),
  constraint line_pay_callback_events_result_hash_check
    check (
      provider_result_sha256 is null
      or provider_result_sha256 ~ '^[0-9a-f]{64}$'
    ),
  constraint line_pay_callback_events_result_code_check
    check (
      safe_result_code is null
      or (
        pg_catalog.length(safe_result_code) between 1 and 64
        and safe_result_code ~ '^[A-Za-z0-9_:-]+$'
        and safe_result_code !~* '^fake_test_(token|signature|authorization)_do_not_use$'
      )
    ),
  constraint line_pay_callback_events_error_code_check
    check (
      last_error_code is null
      or (
        pg_catalog.length(last_error_code) between 1 and 64
        and last_error_code ~ '^[a-z0-9_:-]+$'
        and last_error_code !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      )
    )
);

create table public.line_pay_payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid null references public.payments(id) on delete restrict,
  product_order_id uuid null references public.product_orders(id) on delete restrict,
  checkout_attempt_id uuid null references public.line_pay_checkout_attempts(id) on delete restrict,
  environment text not null,
  event_type text not null,
  from_state text null,
  to_state text null,
  error_code text null,
  request_id text null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint line_pay_payment_audit_events_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_payment_audit_events_event_type_check
    check (
      pg_catalog.length(event_type) between 1 and 64
      and event_type ~ '^[a-z0-9_:-]+$'
    ),
  constraint line_pay_payment_audit_events_state_check
    check (
      (from_state is null or (
        pg_catalog.length(from_state) between 1 and 64
        and from_state ~ '^[a-z0-9_:-]+$'
      ))
      and (to_state is null or (
        pg_catalog.length(to_state) between 1 and 64
        and to_state ~ '^[a-z0-9_:-]+$'
      ))
    ),
  constraint line_pay_payment_audit_events_error_code_check
    check (
      error_code is null
      or (
        pg_catalog.length(error_code) between 1 and 64
        and error_code ~ '^[a-z0-9_:-]+$'
        and error_code !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      )
    ),
  constraint line_pay_payment_audit_events_request_id_check
    check (
      request_id is null
      or (
        pg_catalog.length(request_id) between 1 and 128
        and request_id ~ '^[A-Za-z0-9_.:-]+$'
      )
    ),
  constraint line_pay_payment_audit_events_evidence_check
    check (public.line_pay_audit_evidence_is_valid(evidence)),
  constraint line_pay_payment_audit_events_marker_check
    check (
      event_type !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      and coalesce(from_state, '') !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      and coalesce(to_state, '') !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      and coalesce(error_code, '') !~ '^fake_test_(token|signature|authorization)_do_not_use$'
      and coalesce(request_id, '') !~ '^fake_test_(token|signature|authorization)_do_not_use$'
    )
);

alter table public.product_orders
  add constraint product_orders_checkout_attempt_id_fkey
  foreign key (checkout_attempt_id)
  references public.line_pay_checkout_attempts(id)
  on delete restrict
  deferrable initially deferred
  not valid;

alter table public.payments
  add constraint payments_checkout_attempt_id_fkey
  foreign key (checkout_attempt_id)
  references public.line_pay_checkout_attempts(id)
  on delete restrict
  deferrable initially deferred
  not valid;

alter table public.product_orders validate constraint product_orders_checkout_attempt_id_fkey;
alter table public.payments validate constraint payments_checkout_attempt_id_fkey;

create unique index line_pay_checkout_attempts_environment_key_idx
on public.line_pay_checkout_attempts(environment, provider, idempotency_key);

create unique index line_pay_checkout_attempts_environment_transaction_idx
on public.line_pay_checkout_attempts(environment, provider, upstream_transaction_id)
where upstream_transaction_id is not null;

create unique index line_pay_checkout_attempts_environment_merchant_idx
on public.line_pay_checkout_attempts(environment, provider, merchant_order_no);

create unique index line_pay_checkout_attempts_payment_id_idx
on public.line_pay_checkout_attempts(payment_id)
where payment_id is not null;

create index line_pay_checkout_attempts_owner_idx
on public.line_pay_checkout_attempts(user_id, created_at desc);

create index line_pay_checkout_attempts_order_idx
on public.line_pay_checkout_attempts(product_order_id, created_at desc);

create index line_pay_checkout_attempts_reconciliation_idx
on public.line_pay_checkout_attempts(environment, updated_at)
where reconciliation_required;

create unique index line_pay_request_outbox_attempt_operation_idx
on public.line_pay_request_outbox(checkout_attempt_id, operation);

create unique index line_pay_request_outbox_environment_key_idx
on public.line_pay_request_outbox(environment, provider, idempotency_key);

create index line_pay_request_outbox_claimable_idx
on public.line_pay_request_outbox(environment, next_attempt_at, created_at)
where state = 'queued';

create index line_pay_request_outbox_reconciliation_idx
on public.line_pay_request_outbox(environment, updated_at)
where state in ('unknown', 'reconciliation_required');

create unique index line_pay_callback_capabilities_token_hash_idx
on public.line_pay_callback_capabilities(token_hash);

create unique index line_pay_callback_capabilities_binding_idx
on public.line_pay_callback_capabilities(payment_id, purpose, capability_version);

create index line_pay_callback_capabilities_active_idx
on public.line_pay_callback_capabilities(environment, purpose, expires_at)
where consumed_at is null and revoked_at is null;

create index line_pay_callback_events_binding_idx
on public.line_pay_callback_events(payment_id, product_order_id, created_at desc);

create index line_pay_callback_events_reconciliation_idx
on public.line_pay_callback_events(environment, updated_at)
where state = 'reconciliation_required';

create index line_pay_payment_audit_events_payment_idx
on public.line_pay_payment_audit_events(payment_id, created_at desc);

create index line_pay_payment_audit_events_order_idx
on public.line_pay_payment_audit_events(product_order_id, created_at desc);

create index line_pay_payment_audit_events_attempt_idx
on public.line_pay_payment_audit_events(checkout_attempt_id, created_at desc);

create index product_orders_owner_id_idx
on public.product_orders(user_id, id);

create unique index product_orders_checkout_attempt_id_idx
on public.product_orders(checkout_attempt_id)
where checkout_attempt_id is not null;

create index payments_product_order_owner_idx
on public.payments(product_order_id, user_id);

create unique index payments_checkout_attempt_id_idx
on public.payments(checkout_attempt_id)
where checkout_attempt_id is not null;

create unique index payments_line_pay_idempotency_idx
on public.payments(environment, provider, request_idempotency_key)
where provider = 'line_pay' and request_idempotency_key is not null;

create unique index payments_line_pay_transaction_idx
on public.payments(environment, provider, line_pay_transaction_id)
where provider = 'line_pay' and line_pay_transaction_id is not null;

create or replace function public.line_pay_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function public.line_pay_enforce_attempt_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.provider = 'line_pay' and new.request_state = 'paid' then
      raise exception using
        errcode = '23514',
        message = 'line_pay_paid_attempt_must_use_atomic_completion';
    end if;
    return new;
  end if;

  if old.request_state = 'paid'
     and (pg_catalog.to_jsonb(new) - 'updated_at')
       is distinct from (pg_catalog.to_jsonb(old) - 'updated_at') then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_attempt_evidence_is_immutable';
  end if;

  if old.request_state <> 'paid' and new.request_state = 'paid' and not exists (
    select 1
    from line_pay_private.line_pay_completion_proofs as proof
    where proof.checkout_attempt_id = new.id
      and proof.payment_id = new.payment_id
      and proof.product_order_id = new.product_order_id
      and proof.environment = new.environment
      and proof.merchant_order_no = new.merchant_order_no
      and proof.transaction_id = new.upstream_transaction_id
      and proof.amount_twd = new.amount_twd
      and proof.currency = new.currency
      and proof.completed_at = new.completed_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_attempt_completion_proof_required';
  end if;

  if old.request_state = new.request_state then
    return new;
  end if;

  if not (
    (old.request_state = 'initialized' and new.request_state in ('queued', 'canceled'))
    or (old.request_state = 'queued' and new.request_state in ('claimed', 'requesting', 'canceled'))
    or (old.request_state = 'claimed' and new.request_state in ('queued', 'requesting', 'reconciliation_required', 'canceled'))
    or (old.request_state = 'requesting' and new.request_state in ('pending', 'succeeded', 'failed', 'unknown', 'reconciliation_required', 'canceled'))
    or (old.request_state = 'pending' and new.request_state in ('succeeded', 'confirmation_processing', 'failed', 'reconciliation_required', 'canceled'))
    or (old.request_state = 'succeeded' and new.request_state in ('confirmation_processing', 'paid', 'reconciliation_required', 'canceled'))
    or (old.request_state = 'confirmation_processing' and new.request_state in ('pending', 'paid', 'reconciliation_required'))
    or (old.request_state = 'unknown' and new.request_state = 'reconciliation_required')
    or (old.request_state = 'reconciliation_required' and new.request_state in ('pending', 'confirmation_processing', 'paid', 'failed', 'canceled'))
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_invalid_attempt_state_transition';
  end if;

  if new.request_state in ('unknown', 'reconciliation_required')
     and not new.reconciliation_required then
    raise exception using
      errcode = '23514',
      message = 'line_pay_attempt_reconciliation_marker_required';
  end if;

  if old.request_state = 'paid' and new.request_state <> 'paid' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_attempt_is_terminal';
  end if;

  new.state_version := old.state_version + 1;
  return new;
end;
$$;

create or replace function public.line_pay_enforce_payment_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.provider = 'line_pay'
       and (new.status = 'paid' or new.request_state = 'paid') then
      raise exception using
        errcode = '23514',
        message = 'line_pay_paid_payment_must_use_atomic_completion';
    end if;
    return new;
  end if;

  if old.provider <> 'line_pay' and new.provider <> 'line_pay' then
    return new;
  end if;

  if old.provider <> 'line_pay' and new.provider = 'line_pay' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_payment_provider_must_be_set_on_insert';
  end if;

  if old.provider = 'line_pay' and new.provider <> 'line_pay' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_payment_provider_is_immutable';
  end if;

  if old.status = 'paid' and (
    new.user_id is distinct from old.user_id
    or new.provider is distinct from old.provider
    or new.product_order_id is distinct from old.product_order_id
    or new.checkout_attempt_id is distinct from old.checkout_attempt_id
    or new.environment is distinct from old.environment
    or new.merchant_order_no is distinct from old.merchant_order_no
    or new.line_pay_transaction_id is distinct from old.line_pay_transaction_id
    or new.provider_trade_no is distinct from old.provider_trade_no
    or new.amount_twd is distinct from old.amount_twd
    or new.currency is distinct from old.currency
    or new.paid_at is distinct from old.paid_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_payment_evidence_is_immutable';
  end if;

  if (old.status <> 'paid' or old.request_state is distinct from 'paid')
     and (new.status = 'paid' or new.request_state = 'paid') then
    if new.status <> 'paid'
       or new.request_state <> 'paid'
       or new.paid_at is null
       or new.line_pay_transaction_id is null
       or new.provider_trade_no is distinct from new.line_pay_transaction_id
       or not exists (
         select 1
         from line_pay_private.line_pay_completion_proofs as proof
         where proof.payment_id = new.id
           and proof.product_order_id = new.product_order_id
           and proof.checkout_attempt_id = new.checkout_attempt_id
           and proof.environment = new.environment
           and proof.merchant_order_no = new.merchant_order_no
           and proof.transaction_id = new.line_pay_transaction_id
           and proof.amount_twd = new.amount_twd
           and proof.currency = new.currency
           and proof.provider_result_code = '0000'
           and proof.completed_at = new.paid_at
       ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_paid_payment_completion_proof_required';
    end if;
  end if;

  if old.status = 'paid' and new.status <> 'paid' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_payment_is_terminal';
  end if;

  if old.status is distinct from new.status
     and not (
       old.status = 'pending'
       and new.status in ('paid', 'failed', 'cancelled')
     ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_invalid_payment_status_transition';
  end if;

  if old.request_state is distinct from new.request_state then
    if not (
      (old.request_state is null and new.request_state = 'initialized')
      or (old.request_state = 'initialized' and new.request_state in ('requesting', 'failed', 'canceled'))
      or (old.request_state = 'requesting' and new.request_state in ('pending', 'failed', 'reconciliation_required', 'canceled'))
      or (old.request_state = 'pending' and new.request_state in ('confirmation_processing', 'paid', 'failed', 'reconciliation_required', 'canceled'))
      or (old.request_state = 'confirmation_processing' and new.request_state in ('pending', 'paid', 'reconciliation_required'))
      or (old.request_state = 'reconciliation_required' and new.request_state in ('pending', 'confirmation_processing', 'paid', 'failed', 'canceled'))
    ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_invalid_payment_state_transition';
    end if;
  end if;

  if new.request_state = 'reconciliation_required'
     and not new.reconciliation_required then
    raise exception using
      errcode = '23514',
      message = 'line_pay_payment_reconciliation_marker_required';
  end if;

  if old.request_state = 'paid' and new.request_state <> 'paid' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_payment_request_state_is_terminal';
  end if;

  new.state_version := old.state_version + 1;
  return new;
end;
$$;

create or replace function public.line_pay_enforce_product_order_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_method = 'line_pay'
       and (new.payment_status = 'paid' or new.order_status = 'paid' or new.payment_request_state = 'paid') then
      raise exception using
        errcode = '23514',
        message = 'line_pay_paid_order_must_use_atomic_completion';
    end if;
    return new;
  end if;

  if old.payment_method <> 'line_pay' and new.payment_method <> 'line_pay' then
    return new;
  end if;

  if old.payment_method <> 'line_pay' and new.payment_method = 'line_pay' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_order_payment_method_must_be_set_on_insert';
  end if;

  if old.payment_method = 'line_pay' and new.payment_method <> 'line_pay' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_order_payment_method_is_immutable';
  end if;

  if old.payment_status = 'paid' and (
    new.user_id is distinct from old.user_id
    or new.payment_id is distinct from old.payment_id
    or new.payment_method is distinct from old.payment_method
    or new.environment is distinct from old.environment
    or new.checkout_attempt_id is distinct from old.checkout_attempt_id
    or new.total_amount_twd is distinct from old.total_amount_twd
    or new.currency is distinct from old.currency
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_order_evidence_is_immutable';
  end if;

  if (old.payment_status <> 'paid' or old.payment_request_state is distinct from 'paid')
     and (new.payment_status = 'paid' or new.order_status = 'paid' or new.payment_request_state = 'paid') then
    if new.payment_status <> 'paid'
       or new.order_status <> 'paid'
       or new.payment_request_state <> 'paid'
       or not exists (
         select 1
         from line_pay_private.line_pay_completion_proofs as proof
         where proof.product_order_id = new.id
           and proof.payment_id = new.payment_id
           and proof.checkout_attempt_id = new.checkout_attempt_id
           and proof.environment = new.environment
           and proof.amount_twd = new.total_amount_twd
           and proof.currency = new.currency
       ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_paid_order_completion_proof_required';
    end if;
  end if;

  if old.payment_status = 'paid' and new.payment_status <> 'paid' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_order_payment_status_is_terminal';
  end if;

  if old.payment_status is distinct from new.payment_status
     and not (
       old.payment_status = 'pending'
       and new.payment_status in ('paid', 'failed', 'canceled')
     ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_invalid_product_order_payment_status_transition';
  end if;

  if old.order_status is distinct from new.order_status then
    if not (
      (old.order_status = 'pending_payment' and new.order_status in ('payment_requesting', 'payment_failed', 'canceled'))
      or (old.order_status = 'payment_requesting' and new.order_status in ('payment_pending', 'payment_failed', 'canceled'))
      or (old.order_status = 'payment_pending' and new.order_status in ('paid', 'payment_failed', 'canceled'))
      or (old.order_status = 'paid' and new.order_status in ('preparing', 'shipped', 'completed'))
      or (old.order_status = 'preparing' and new.order_status in ('shipped', 'completed'))
      or (old.order_status = 'shipped' and new.order_status = 'completed')
    ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_invalid_product_order_state_transition';
    end if;
  end if;

  if old.payment_request_state is distinct from new.payment_request_state then
    if not (
      (old.payment_request_state is null and new.payment_request_state = 'initialized')
      or (old.payment_request_state = 'initialized' and new.payment_request_state in ('requesting', 'failed', 'canceled'))
      or (old.payment_request_state = 'requesting' and new.payment_request_state in ('pending', 'failed', 'reconciliation_required', 'canceled'))
      or (old.payment_request_state = 'pending' and new.payment_request_state in ('confirmation_processing', 'paid', 'failed', 'reconciliation_required', 'canceled'))
      or (old.payment_request_state = 'confirmation_processing' and new.payment_request_state in ('pending', 'paid', 'reconciliation_required'))
      or (old.payment_request_state = 'reconciliation_required' and new.payment_request_state in ('pending', 'confirmation_processing', 'paid', 'failed', 'canceled'))
    ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_invalid_product_order_request_state_transition';
    end if;
  end if;

  if new.sandbox_test and (
    new.environment <> 'sandbox'
    or new.fulfillment_mode <> 'none'
    or new.shipping_status <> 'not_applicable'
    or new.order_status in ('preparing', 'shipped', 'completed')
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_sandbox_fulfillment_is_forbidden';
  end if;

  if old.order_status = 'paid' and new.order_status in (
    'pending_payment',
    'payment_requesting',
    'payment_pending',
    'payment_failed',
    'canceled'
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_product_order_is_terminal';
  end if;

  new.state_version := old.state_version + 1;
  return new;
end;
$$;

create or replace function public.line_pay_enforce_outbox_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.state = new.state then
    return new;
  end if;

  if not (
    (old.state = 'queued' and new.state in ('claimed', 'canceled'))
    or (old.state = 'claimed' and new.state in ('completed', 'failed', 'unknown', 'reconciliation_required', 'canceled'))
    or (old.state = 'unknown' and new.state = 'reconciliation_required')
    or (old.state = 'reconciliation_required' and new.state in ('completed', 'failed', 'canceled'))
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_invalid_outbox_state_transition';
  end if;

  return new;
end;
$$;

create or replace function public.line_pay_enforce_callback_capability_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_id is distinct from old.payment_id
     or new.product_order_id is distinct from old.product_order_id
     or new.checkout_attempt_id is distinct from old.checkout_attempt_id
     or new.environment is distinct from old.environment
     or new.purpose is distinct from old.purpose
     or new.token_hash is distinct from old.token_hash
     or new.capability_version is distinct from old.capability_version then
    raise exception using
      errcode = '23514',
      message = 'line_pay_callback_capability_binding_is_immutable';
  end if;

  if old.consumed_at is not null
     and (pg_catalog.to_jsonb(new) - 'updated_at')
       is distinct from (pg_catalog.to_jsonb(old) - 'updated_at') then
    raise exception using
      errcode = '23514',
      message = 'line_pay_consumed_callback_capability_is_immutable';
  end if;

  if old.purpose = 'confirm'
     and old.consumed_at is null
     and new.consumed_at is not null then
    if current_user <> 'line_pay_payment_function_owner'
       or not exists (
         select 1
         from line_pay_private.line_pay_completion_proofs as proof
         where proof.capability_id = new.id
           and proof.payment_id = new.payment_id
           and proof.product_order_id = new.product_order_id
           and proof.checkout_attempt_id = new.checkout_attempt_id
           and proof.environment = new.environment
           and proof.completed_at = new.consumed_at
       ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_confirm_capability_completion_proof_required';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.line_pay_enforce_callback_event_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.capability_id is distinct from old.capability_id
     or new.payment_id is distinct from old.payment_id
     or new.product_order_id is distinct from old.product_order_id
     or new.checkout_attempt_id is distinct from old.checkout_attempt_id
     or new.environment is distinct from old.environment
     or new.purpose is distinct from old.purpose then
    raise exception using
      errcode = '23514',
      message = 'line_pay_callback_event_binding_is_immutable';
  end if;

  if old.state = 'completed'
     and (pg_catalog.to_jsonb(new) - 'updated_at')
       is distinct from (pg_catalog.to_jsonb(old) - 'updated_at') then
    raise exception using
      errcode = '23514',
      message = 'line_pay_completed_callback_event_is_immutable';
  end if;

  if (
    new.provider_result_sha256 is distinct from old.provider_result_sha256
    or new.safe_result_code is distinct from old.safe_result_code
    or (old.state <> 'provider_verified' and new.state = 'provider_verified')
  ) and current_user <> 'line_pay_payment_function_owner' then
    raise exception using
      errcode = '42501',
      message = 'line_pay_provider_evidence_requires_dedicated_executor';
  end if;

  if new.state = 'provider_verified' and (
    new.safe_result_code <> '0000'
    or new.provider_result_sha256 is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_provider_verified_success_evidence_required';
  end if;

  if old.purpose = 'confirm'
     and old.state <> 'completed'
     and new.state = 'completed' then
    if current_user <> 'line_pay_payment_function_owner'
       or not exists (
         select 1
         from line_pay_private.line_pay_completion_proofs as proof
         where proof.callback_event_id = new.id
           and proof.capability_id = new.capability_id
           and proof.payment_id = new.payment_id
           and proof.product_order_id = new.product_order_id
           and proof.checkout_attempt_id = new.checkout_attempt_id
           and proof.environment = new.environment
           and proof.provider_result_code = new.safe_result_code
           and proof.provider_result_sha256 = new.provider_result_sha256
           and proof.completed_at = new.completed_at
       ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_callback_completion_proof_required';
    end if;
  end if;

  if old.state = new.state then
    return new;
  end if;

  if not (
    (old.state = 'received' and new.state = 'claimed')
    or (old.state = 'claimed' and new.state in ('provider_verified', 'completed', 'failed', 'reconciliation_required'))
    or (old.state = 'provider_verified' and new.state in ('completed', 'reconciliation_required'))
    or (old.state = 'reconciliation_required' and new.state in ('provider_verified', 'completed', 'failed'))
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_invalid_callback_event_state_transition';
  end if;

  return new;
end;
$$;

create trigger line_pay_checkout_attempts_touch_updated_at
before update on public.line_pay_checkout_attempts
for each row execute function public.line_pay_touch_updated_at();

create trigger line_pay_request_outbox_touch_updated_at
before update on public.line_pay_request_outbox
for each row execute function public.line_pay_touch_updated_at();

create trigger line_pay_request_outbox_transition_guard
before update on public.line_pay_request_outbox
for each row execute function public.line_pay_enforce_outbox_transition();

create trigger line_pay_callback_capabilities_touch_updated_at
before update on public.line_pay_callback_capabilities
for each row execute function public.line_pay_touch_updated_at();

create trigger line_pay_callback_capabilities_transition_guard
before update on public.line_pay_callback_capabilities
for each row execute function public.line_pay_enforce_callback_capability_transition();

create trigger line_pay_callback_events_touch_updated_at
before update on public.line_pay_callback_events
for each row execute function public.line_pay_touch_updated_at();

create trigger line_pay_callback_events_transition_guard
before update on public.line_pay_callback_events
for each row execute function public.line_pay_enforce_callback_event_transition();

create trigger line_pay_checkout_attempts_transition_guard
before insert or update on public.line_pay_checkout_attempts
for each row execute function public.line_pay_enforce_attempt_transition();

create trigger line_pay_payments_transition_guard
before insert or update on public.payments
for each row execute function public.line_pay_enforce_payment_transition();

create trigger line_pay_product_orders_transition_guard
before insert or update on public.product_orders
for each row execute function public.line_pay_enforce_product_order_transition();

alter table public.app_environment_attestation enable row level security;
alter table public.line_pay_checkout_attempts enable row level security;
alter table public.line_pay_request_outbox enable row level security;
alter table public.line_pay_callback_capabilities enable row level security;
alter table public.line_pay_callback_events enable row level security;
alter table public.line_pay_payment_audit_events enable row level security;

revoke all on table public.app_environment_attestation from public, anon, authenticated;
revoke all on table public.line_pay_checkout_attempts from public, anon, authenticated;
revoke all on table public.line_pay_request_outbox from public, anon, authenticated;
revoke all on table public.line_pay_callback_capabilities from public, anon, authenticated;
revoke all on table public.line_pay_callback_events from public, anon, authenticated;
revoke all on table public.line_pay_payment_audit_events from public, anon, authenticated;

grant select on table public.app_environment_attestation to service_role;
grant select, insert, update on table public.line_pay_checkout_attempts to service_role;
grant select, insert, update on table public.line_pay_request_outbox to service_role;
grant select, insert, update on table public.line_pay_callback_capabilities to service_role;
grant select, insert, update on table public.line_pay_callback_events to service_role;
revoke all on table public.line_pay_payment_audit_events from service_role;

revoke execute on function public.line_pay_sanitized_result_is_valid(jsonb)
from public, anon, authenticated;
revoke execute on function public.line_pay_audit_evidence_is_valid(jsonb)
from public, anon, authenticated;
revoke execute on function public.line_pay_touch_updated_at()
from public, anon, authenticated;
revoke execute on function public.line_pay_enforce_attempt_transition()
from public, anon, authenticated;
revoke execute on function public.line_pay_enforce_payment_transition()
from public, anon, authenticated;
revoke execute on function public.line_pay_enforce_product_order_transition()
from public, anon, authenticated;
revoke execute on function public.line_pay_enforce_outbox_transition()
from public, anon, authenticated;
revoke execute on function public.line_pay_enforce_callback_event_transition()
from public, anon, authenticated;

grant execute on function public.line_pay_sanitized_result_is_valid(jsonb)
to service_role;
grant execute on function public.line_pay_audit_evidence_is_valid(jsonb)
to service_role;

create or replace function public.claim_product_order_line_pay_request(
  p_attempt_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_body_sha256 text,
  p_claim_id uuid,
  p_claim_expires_at timestamptz
)
returns table (
  result_code text,
  attempt_id uuid,
  payment_id uuid,
  request_state text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_outbox public.line_pay_request_outbox%rowtype;
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_attempt_id is null
     or p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_idempotency_key is null
     or p_request_body_sha256 is null
     or p_claim_id is null
     or p_claim_expires_at is null
     or p_claim_expires_at <= v_now
     or p_claim_expires_at > v_now + interval '5 minutes'
     or p_request_body_sha256 !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(p_idempotency_key) not between 16 and 200 then
    raise exception using
      errcode = '22023',
      message = 'line_pay_request_claim_invalid_input';
  end if;

  select candidate.payment_id, candidate.product_order_id
  into v_payment_id, v_order_id
  from public.line_pay_checkout_attempts as candidate
  where candidate.id = p_attempt_id;

  if not found or v_payment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_request_attempt_not_found';
  end if;

  select payment.*
  into strict v_payment
  from public.payments as payment
  where payment.id = v_payment_id
  for update;

  select product_order.*
  into strict v_order
  from public.product_orders as product_order
  where product_order.id = v_order_id
  for update;

  select attempt.*
  into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select outbox.*
  into strict v_outbox
  from public.line_pay_request_outbox as outbox
  where outbox.checkout_attempt_id = p_attempt_id
    and outbox.operation = 'request'
  for update;

  if v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.idempotency_key <> p_idempotency_key
     or v_attempt.request_body_sha256 <> p_request_body_sha256
     or v_outbox.environment <> p_environment
     or v_outbox.provider <> 'line_pay'
     or v_outbox.idempotency_key <> p_idempotency_key
     or v_outbox.request_body_sha256 <> p_request_body_sha256
     or v_outbox.payment_id <> v_attempt.payment_id
     or v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_payment.request_idempotency_key <> p_idempotency_key
     or v_payment.request_body_sha256 <> p_request_body_sha256
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_order.user_id <> v_attempt.user_id
     or v_payment.user_id <> v_attempt.user_id
     or v_payment.amount_twd <> v_attempt.amount_twd
     or v_order.total_amount_twd <> v_attempt.amount_twd
     or v_payment.currency <> 'TWD'
     or v_order.currency <> 'TWD' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_request_claim_contract_mismatch';
  end if;

  if v_attempt.request_state in ('succeeded', 'paid') then
    return query select
      'already_succeeded'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state in ('unknown', 'reconciliation_required') then
    return query select
      'reconciliation_required'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state in ('failed', 'canceled') then
    return query select
      'terminal'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state = 'requesting'
     and v_attempt.claim_id = p_claim_id
     and v_attempt.claim_expires_at > v_now then
    return query select
      'already_claimed'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state = 'requesting'
     and v_attempt.claim_id <> p_claim_id
     and v_attempt.claim_expires_at > v_now then
    return query select
      'claim_busy'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state = 'requesting' then
    update public.line_pay_checkout_attempts
    set request_state = 'reconciliation_required',
        reconciliation_required = true,
        last_error_code = 'request_claim_expired_unknown'
    where id = v_attempt.id;

    update public.line_pay_request_outbox
    set state = 'unknown',
        last_error_code = 'request_claim_expired_unknown'
    where id = v_outbox.id;

    update public.payments
    set request_state = 'reconciliation_required',
        reconciliation_required = true
    where id = v_payment.id;

    update public.product_orders
    set order_status = 'payment_pending',
        payment_request_state = 'reconciliation_required',
        reconciliation_required = true
    where id = v_order.id;

    insert into public.line_pay_payment_audit_events (
      payment_id,
      product_order_id,
      checkout_attempt_id,
      environment,
      event_type,
      from_state,
      to_state,
      error_code,
      evidence
    ) values (
      v_payment.id,
      v_order.id,
      v_attempt.id,
      p_environment,
      'request_claim_expired',
      'requesting',
      'reconciliation_required',
      'request_claim_expired_unknown',
      '{"reason_code":"request_claim_expired_unknown"}'::jsonb
    );

    return query select
      'reconciliation_required'::text,
      v_attempt.id,
      v_attempt.payment_id,
      'reconciliation_required'::text,
      v_attempt.attempt_count;
    return;
  end if;

  if v_attempt.request_state not in ('queued', 'claimed')
     or v_outbox.state not in ('queued', 'claimed') then
    raise exception using
      errcode = '55000',
      message = 'line_pay_request_attempt_not_claimable';
  end if;

  if v_attempt.request_state = 'claimed'
     and v_attempt.claim_id <> p_claim_id
     and v_attempt.claim_expires_at > v_now then
    return query select
      'claim_busy'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.attempt_count;
    return;
  end if;

  update public.line_pay_checkout_attempts as target_attempt
  set request_state = 'requesting',
      attempt_count = target_attempt.attempt_count + 1,
      claim_id = p_claim_id,
      claimed_at = v_now,
      claim_expires_at = p_claim_expires_at,
      reconciliation_required = false,
      last_error_code = null
  where id = v_attempt.id;

  update public.line_pay_request_outbox as target_outbox
  set state = 'claimed',
      attempt_count = target_outbox.attempt_count + 1,
      claim_id = p_claim_id,
      claimed_at = v_now,
      claim_expires_at = p_claim_expires_at,
      last_error_code = null
  where id = v_outbox.id;

  update public.payments
  set request_state = 'requesting',
      reconciliation_required = false
  where id = v_payment.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_payment_claim_update_failed';
  end if;

  update public.product_orders
  set order_status = 'payment_requesting',
      payment_request_state = 'requesting',
      reconciliation_required = false
  where id = v_order.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_order_claim_update_failed';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'request_claimed',
    v_attempt.request_state,
    'requesting',
    '{"result_code":"claimed"}'::jsonb
  );

  return query
  select
    'claimed'::text,
    v_attempt.id,
    v_attempt.payment_id,
    'requesting'::text,
    v_attempt.attempt_count + 1;
end;
$$;

create or replace function public.record_product_order_line_pay_request_success(
  p_attempt_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_body_sha256 text,
  p_claim_id uuid,
  p_upstream_transaction_id text,
  p_merchant_order_no text,
  p_sanitized_result jsonb,
  p_request_id text default null
)
returns table (
  result_code text,
  attempt_id uuid,
  payment_id uuid,
  request_state text,
  upstream_transaction_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_outbox public.line_pay_request_outbox%rowtype;
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_audit_evidence jsonb;
begin
  if p_attempt_id is null
     or p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_idempotency_key is null
     or p_request_body_sha256 is null
     or p_upstream_transaction_id is null
     or p_merchant_order_no is null
     or p_claim_id is null
     or p_request_body_sha256 !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(p_idempotency_key) not between 16 and 200
     or pg_catalog.length(p_upstream_transaction_id) not between 1 and 128
     or p_upstream_transaction_id ~ '[[:space:]]'
     or pg_catalog.length(p_merchant_order_no) not between 1 and 100
     or p_merchant_order_no ~ '[[:space:]]'
     or not public.line_pay_sanitized_result_is_valid(p_sanitized_result)
     or p_sanitized_result ->> 'result_code' <> '0000'
     or p_sanitized_result ->> 'transaction_id' <> p_upstream_transaction_id
     or p_sanitized_result ->> 'merchant_order_no' <> p_merchant_order_no
     or p_sanitized_result ->> 'response_sha256' !~ '^[0-9a-f]{64}$'
     or (p_request_id is not null and p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$') then
    raise exception using
      errcode = '22023',
      message = 'line_pay_request_success_invalid_input';
  end if;

  select candidate.payment_id, candidate.product_order_id
  into v_payment_id, v_order_id
  from public.line_pay_checkout_attempts as candidate
  where candidate.id = p_attempt_id;

  if not found or v_payment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_request_attempt_not_found';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = v_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = v_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select outbox.* into strict v_outbox
  from public.line_pay_request_outbox as outbox
  where outbox.checkout_attempt_id = p_attempt_id
    and outbox.operation = 'request'
  for update;

  if v_attempt.environment <> p_environment
     or v_attempt.provider <> 'line_pay'
     or v_attempt.idempotency_key <> p_idempotency_key
     or v_attempt.request_body_sha256 <> p_request_body_sha256
     or v_outbox.environment <> p_environment
     or v_outbox.idempotency_key <> p_idempotency_key
     or v_outbox.request_body_sha256 <> p_request_body_sha256
     or v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_attempt.merchant_order_no <> p_merchant_order_no
     or v_payment.merchant_order_no <> p_merchant_order_no
     or v_payment.amount_twd <> v_attempt.amount_twd
     or v_order.total_amount_twd <> v_attempt.amount_twd
     or v_payment.currency <> 'TWD'
     or v_order.currency <> 'TWD' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_request_success_contract_mismatch';
  end if;

  if v_attempt.request_state in ('succeeded', 'paid') then
    if v_attempt.upstream_transaction_id <> p_upstream_transaction_id then
      raise exception using
        errcode = '23505',
        message = 'line_pay_request_success_transaction_conflict';
    end if;

    return query select
      'already_recorded'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state,
      v_attempt.upstream_transaction_id;
    return;
  end if;

  if v_attempt.request_state <> 'requesting'
     or v_attempt.claim_id <> p_claim_id
     or v_outbox.state <> 'claimed'
     or v_outbox.claim_id <> p_claim_id then
    raise exception using
      errcode = '55000',
      message = 'line_pay_request_success_claim_mismatch';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'succeeded',
      upstream_transaction_id = p_upstream_transaction_id,
      sanitized_result = p_sanitized_result,
      reconciliation_required = false,
      completed_at = pg_catalog.clock_timestamp(),
      last_error_code = null
  where id = v_attempt.id;

  update public.line_pay_request_outbox
  set state = 'completed',
      completed_at = pg_catalog.clock_timestamp(),
      last_error_code = null
  where id = v_outbox.id;

  update public.payments
  set request_state = 'pending',
      line_pay_transaction_id = p_upstream_transaction_id,
      reconciliation_required = false
  where id = v_payment.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_success_payment_update_failed';
  end if;

  update public.product_orders
  set order_status = 'payment_pending',
      payment_request_state = 'pending',
      reconciliation_required = false
  where id = v_order.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_success_order_update_failed';
  end if;

  v_audit_evidence := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'result_code', p_sanitized_result ->> 'result_code',
    'result_sha256', p_sanitized_result ->> 'response_sha256'
  ));

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'request_succeeded',
    'requesting',
    'pending',
    p_request_id,
    v_audit_evidence
  );

  return query select
    'recorded'::text,
    v_attempt.id,
    v_attempt.payment_id,
    'succeeded'::text,
    p_upstream_transaction_id;
end;
$$;

create or replace function public.record_product_order_line_pay_request_failure(
  p_attempt_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_body_sha256 text,
  p_claim_id uuid,
  p_error_code text,
  p_request_id text default null
)
returns table (
  result_code text,
  attempt_id uuid,
  payment_id uuid,
  request_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_outbox public.line_pay_request_outbox%rowtype;
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
begin
  if p_attempt_id is null
     or p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_idempotency_key is null
     or p_request_body_sha256 is null
     or p_error_code is null
     or p_claim_id is null
     or p_request_body_sha256 !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(p_idempotency_key) not between 16 and 200
     or p_error_code !~ '^[a-z0-9_:-]{1,64}$'
     or p_error_code ~ '^fake_test_(token|signature|authorization)_do_not_use$'
     or (p_request_id is not null and p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$') then
    raise exception using
      errcode = '22023',
      message = 'line_pay_request_failure_invalid_input';
  end if;

  select candidate.payment_id, candidate.product_order_id
  into v_payment_id, v_order_id
  from public.line_pay_checkout_attempts as candidate
  where candidate.id = p_attempt_id;

  if not found or v_payment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_request_attempt_not_found';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = v_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = v_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select outbox.* into strict v_outbox
  from public.line_pay_request_outbox as outbox
  where outbox.checkout_attempt_id = p_attempt_id
    and outbox.operation = 'request'
  for update;

  if v_attempt.environment <> p_environment
     or v_attempt.provider <> 'line_pay'
     or v_attempt.idempotency_key <> p_idempotency_key
     or v_attempt.request_body_sha256 <> p_request_body_sha256
     or v_outbox.environment <> p_environment
     or v_outbox.idempotency_key <> p_idempotency_key
     or v_outbox.request_body_sha256 <> p_request_body_sha256
     or v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id then
    raise exception using
      errcode = '23514',
      message = 'line_pay_request_failure_contract_mismatch';
  end if;

  if v_attempt.request_state = 'failed' then
    return query select
      'already_recorded'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state;
    return;
  end if;

  if v_attempt.request_state <> 'requesting'
     or v_attempt.claim_id <> p_claim_id
     or v_outbox.state <> 'claimed'
     or v_outbox.claim_id <> p_claim_id then
    raise exception using
      errcode = '55000',
      message = 'line_pay_request_failure_claim_mismatch';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'failed',
      last_error_code = p_error_code,
      completed_at = pg_catalog.clock_timestamp(),
      reconciliation_required = false
  where id = v_attempt.id;

  update public.line_pay_request_outbox
  set state = 'failed',
      last_error_code = p_error_code,
      completed_at = pg_catalog.clock_timestamp()
  where id = v_outbox.id;

  update public.payments
  set status = 'failed',
      request_state = 'failed',
      failure_reason = p_error_code,
      reconciliation_required = false
  where id = v_payment.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_failure_payment_update_failed';
  end if;

  update public.product_orders
  set payment_status = 'failed',
      order_status = 'payment_failed',
      payment_request_state = 'failed',
      reconciliation_required = false
  where id = v_order.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_failure_order_update_failed';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    error_code,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'request_failed',
    'requesting',
    'failed',
    p_error_code,
    p_request_id,
    pg_catalog.jsonb_build_object('reason_code', p_error_code)
  );

  return query select
    'recorded'::text,
    v_attempt.id,
    v_attempt.payment_id,
    'failed'::text;
end;
$$;

create or replace function public.mark_product_order_line_pay_request_unknown(
  p_attempt_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_body_sha256 text,
  p_claim_id uuid,
  p_error_code text,
  p_request_id text default null
)
returns table (
  result_code text,
  attempt_id uuid,
  payment_id uuid,
  request_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_outbox public.line_pay_request_outbox%rowtype;
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
begin
  if p_attempt_id is null
     or p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_idempotency_key is null
     or p_request_body_sha256 is null
     or p_error_code is null
     or p_claim_id is null
     or p_request_body_sha256 !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(p_idempotency_key) not between 16 and 200
     or p_error_code !~ '^[a-z0-9_:-]{1,64}$'
     or p_error_code ~ '^fake_test_(token|signature|authorization)_do_not_use$'
     or (p_request_id is not null and p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$') then
    raise exception using
      errcode = '22023',
      message = 'line_pay_request_unknown_invalid_input';
  end if;

  select candidate.payment_id, candidate.product_order_id
  into v_payment_id, v_order_id
  from public.line_pay_checkout_attempts as candidate
  where candidate.id = p_attempt_id;

  if not found or v_payment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_request_attempt_not_found';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = v_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = v_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select outbox.* into strict v_outbox
  from public.line_pay_request_outbox as outbox
  where outbox.checkout_attempt_id = p_attempt_id
    and outbox.operation = 'request'
  for update;

  if v_attempt.environment <> p_environment
     or v_attempt.provider <> 'line_pay'
     or v_attempt.idempotency_key <> p_idempotency_key
     or v_attempt.request_body_sha256 <> p_request_body_sha256
     or v_outbox.environment <> p_environment
     or v_outbox.idempotency_key <> p_idempotency_key
     or v_outbox.request_body_sha256 <> p_request_body_sha256
     or v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id then
    raise exception using
      errcode = '23514',
      message = 'line_pay_request_unknown_contract_mismatch';
  end if;

  if v_attempt.request_state in ('unknown', 'reconciliation_required') then
    return query select
      'already_recorded'::text,
      v_attempt.id,
      v_attempt.payment_id,
      v_attempt.request_state;
    return;
  end if;

  if v_attempt.request_state <> 'requesting'
     or v_attempt.claim_id <> p_claim_id
     or v_outbox.state <> 'claimed'
     or v_outbox.claim_id <> p_claim_id then
    raise exception using
      errcode = '55000',
      message = 'line_pay_request_unknown_claim_mismatch';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'unknown',
      last_error_code = p_error_code,
      reconciliation_required = true
  where id = v_attempt.id;

  update public.line_pay_request_outbox
  set state = 'unknown',
      last_error_code = p_error_code
  where id = v_outbox.id;

  update public.payments
  set request_state = 'reconciliation_required',
      reconciliation_required = true
  where id = v_payment.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_unknown_payment_update_failed';
  end if;

  update public.product_orders
  set order_status = 'payment_pending',
      payment_request_state = 'reconciliation_required',
      reconciliation_required = true
  where id = v_order.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_request_unknown_order_update_failed';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    error_code,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'request_unknown',
    'requesting',
    'reconciliation_required',
    p_error_code,
    p_request_id,
    pg_catalog.jsonb_build_object('reason_code', p_error_code)
  );

  return query select
    'recorded'::text,
    v_attempt.id,
    v_attempt.payment_id,
    'unknown'::text;
end;
$$;

create or replace function public.read_product_order_line_pay_request_result(
  p_attempt_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_body_sha256 text
)
returns table (
  attempt_id uuid,
  payment_id uuid,
  request_state text,
  upstream_transaction_id text,
  merchant_order_no text,
  sanitized_result jsonb,
  last_error_code text,
  reconciliation_required boolean,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    attempt.id,
    attempt.payment_id,
    attempt.request_state,
    attempt.upstream_transaction_id,
    attempt.merchant_order_no,
    attempt.sanitized_result,
    attempt.last_error_code,
    attempt.reconciliation_required,
    attempt.completed_at
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
    and attempt.provider = 'line_pay'
    and attempt.environment = p_environment
    and attempt.idempotency_key = p_idempotency_key
    and attempt.request_body_sha256 = p_request_body_sha256;
$$;

create or replace function public.claim_line_pay_callback_capability(
  p_token_hash text,
  p_environment text,
  p_purpose text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_claim_id uuid,
  p_claim_expires_at timestamptz
)
returns table (
  result_code text,
  capability_id uuid,
  callback_event_id uuid,
  payment_id uuid,
  product_order_id uuid,
  purpose text,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback_event_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_purpose is null
     or p_purpose not in ('confirm', 'cancel')
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_claim_id is null
     or p_claim_expires_at is null
     or p_claim_expires_at <= v_now
     or p_claim_expires_at > v_now + interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_callback_capability_unavailable';
  end if;

  select capability.*
  into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.token_hash = p_token_hash
  for update;

  if v_capability.environment <> p_environment
     or v_capability.purpose <> p_purpose
     or v_capability.payment_id <> p_payment_id
     or v_capability.product_order_id <> p_product_order_id
     or v_capability.checkout_attempt_id <> p_attempt_id then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_callback_capability_unavailable';
  end if;

  if v_capability.consumed_at is not null then
    select callback_event.id into strict v_callback_event_id
    from public.line_pay_callback_events as callback_event
    where callback_event.capability_id = v_capability.id;

    return query select
      'already_consumed'::text,
      v_capability.id,
      v_callback_event_id,
      v_capability.payment_id,
      v_capability.product_order_id,
      v_capability.purpose,
      v_capability.expires_at;
    return;
  end if;

  if v_capability.revoked_at is not null
     or v_capability.expires_at <= v_now then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_callback_capability_unavailable';
  end if;

  if v_capability.claim_id = p_claim_id
     and v_capability.claim_expires_at > v_now then
    select callback_event.id into strict v_callback_event_id
    from public.line_pay_callback_events as callback_event
    where callback_event.capability_id = v_capability.id;

    return query select
      'already_claimed'::text,
      v_capability.id,
      v_callback_event_id,
      v_capability.payment_id,
      v_capability.product_order_id,
      v_capability.purpose,
      v_capability.expires_at;
    return;
  end if;

  if v_capability.claim_id is not null
     and v_capability.claim_id <> p_claim_id
     and v_capability.claim_expires_at > v_now then
    select callback_event.id into v_callback_event_id
    from public.line_pay_callback_events as callback_event
    where callback_event.capability_id = v_capability.id;

    return query select
      'claim_busy'::text,
      v_capability.id,
      v_callback_event_id,
      v_capability.payment_id,
      v_capability.product_order_id,
      v_capability.purpose,
      v_capability.expires_at;
    return;
  end if;

  update public.line_pay_callback_capabilities
  set claim_id = p_claim_id,
      claimed_at = v_now,
      claim_expires_at = p_claim_expires_at
  where id = v_capability.id;

  insert into public.line_pay_callback_events (
    capability_id,
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    purpose,
    state,
    claim_id,
    claimed_at,
    claim_expires_at
  ) values (
    v_capability.id,
    v_capability.payment_id,
    v_capability.product_order_id,
    v_capability.checkout_attempt_id,
    v_capability.environment,
    v_capability.purpose,
    'claimed',
    p_claim_id,
    v_now,
    p_claim_expires_at
  )
  on conflict on constraint line_pay_callback_events_capability_key do update
  set claim_id = excluded.claim_id,
      claimed_at = excluded.claimed_at,
      claim_expires_at = excluded.claim_expires_at,
      state = 'claimed'
  where line_pay_callback_events.state in ('received', 'claimed')
  returning id into v_callback_event_id;

  if v_callback_event_id is null then
    raise exception using
      errcode = '55000',
      message = 'line_pay_callback_event_not_claimable';
  end if;

  return query select
    'claimed'::text,
    v_capability.id,
    v_callback_event_id,
    v_capability.payment_id,
    v_capability.product_order_id,
    v_capability.purpose,
    v_capability.expires_at;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_callback_capability_unavailable';
end;
$$;

create or replace function public.claim_product_order_line_pay_confirmation(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_callback_claim_id uuid,
  p_transaction_id text,
  p_request_id text
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  request_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback_event public.line_pay_callback_events%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_capability_id is null
     or p_callback_event_id is null
     or p_callback_claim_id is null
     or p_transaction_id is null
     or pg_catalog.length(p_transaction_id) not between 1 and 128
     or p_transaction_id ~ '[[:space:]]'
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_confirmation_claim_invalid_input';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = p_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = p_product_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select capability.* into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.id = p_capability_id
  for update;

  select callback_event.* into strict v_callback_event
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_payment.line_pay_transaction_id <> p_transaction_id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.payment_id <> v_payment.id
     or v_attempt.product_order_id <> v_order.id
     or v_attempt.upstream_transaction_id <> p_transaction_id
     or v_capability.payment_id <> v_payment.id
     or v_capability.product_order_id <> v_order.id
     or v_capability.checkout_attempt_id <> v_attempt.id
     or v_capability.environment <> p_environment
     or v_capability.purpose <> 'confirm'
     or v_callback_event.capability_id <> v_capability.id
     or v_callback_event.payment_id <> v_payment.id
     or v_callback_event.product_order_id <> v_order.id
     or v_callback_event.checkout_attempt_id <> v_attempt.id
     or v_callback_event.environment <> p_environment
     or v_callback_event.purpose <> 'confirm' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_confirmation_claim_contract_mismatch';
  end if;

  if v_payment.status = 'paid' then
    if v_payment.provider_trade_no = p_transaction_id
       and v_order.payment_status = 'paid'
       and v_attempt.request_state = 'paid'
       and v_capability.consumed_at is not null
       and v_callback_event.state = 'completed' then
      return query select
        'already_paid'::text,
        v_payment.id,
        v_order.id,
        v_payment.request_state;
      return;
    end if;

    raise exception using
      errcode = '23514',
      message = 'line_pay_confirmation_claim_paid_conflict';
  end if;

  if v_payment.request_state = 'confirmation_processing'
     and v_order.payment_request_state = 'confirmation_processing'
     and v_attempt.request_state = 'confirmation_processing'
     and v_callback_event.claim_id = p_callback_claim_id then
    return query select
      'already_claimed'::text,
      v_payment.id,
      v_order.id,
      'confirmation_processing'::text;
    return;
  end if;

  if v_payment.status <> 'pending'
     or v_payment.request_state <> 'pending'
     or v_order.payment_status <> 'pending'
     or v_order.order_status <> 'payment_pending'
     or v_order.payment_request_state <> 'pending'
     or v_attempt.request_state <> 'succeeded'
     or v_capability.consumed_at is not null
     or v_capability.revoked_at is not null
     or v_capability.expires_at <= v_now
     or v_capability.claim_id <> p_callback_claim_id
     or v_capability.claim_expires_at <= v_now
     or v_callback_event.state <> 'claimed'
     or v_callback_event.claim_id <> p_callback_claim_id
     or v_callback_event.claim_expires_at <= v_now then
    raise exception using
      errcode = '55000',
      message = 'line_pay_confirmation_not_claimable';
  end if;

  update public.payments
  set request_state = 'confirmation_processing'
  where id = v_payment.id;

  update public.product_orders
  set payment_request_state = 'confirmation_processing'
  where id = v_order.id;

  update public.line_pay_checkout_attempts
  set request_state = 'confirmation_processing'
  where id = v_attempt.id;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'confirmation_claimed',
    'pending',
    'confirmation_processing',
    p_request_id,
    '{"result_code":"claimed"}'::jsonb
  );

  return query select
    'claimed'::text,
    v_payment.id,
    v_order.id,
    'confirmation_processing'::text;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_confirmation_claim_context_not_found';
end;
$$;

create or replace function public.record_product_order_line_pay_confirmation_evidence(
  p_environment text,
  p_callback_event_id uuid,
  p_callback_claim_id uuid,
  p_provider_result_sha256 text,
  p_safe_result_code text,
  p_request_id text
)
returns table (
  result_code text,
  callback_event_id uuid,
  provider_result_sha256 text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback_event public.line_pay_callback_events%rowtype;
  v_payment_id uuid;
  v_order_id uuid;
  v_attempt_id uuid;
  v_capability_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_callback_event_id is null
     or p_callback_claim_id is null
     or p_provider_result_sha256 is null
     or p_provider_result_sha256 !~ '^[0-9a-f]{64}$'
     or p_safe_result_code is null
     or p_safe_result_code <> '0000'
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_confirmation_evidence_invalid_input';
  end if;

  select
    callback_event.payment_id,
    callback_event.product_order_id,
    callback_event.checkout_attempt_id,
    callback_event.capability_id
  into v_payment_id, v_order_id, v_attempt_id, v_capability_id
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_confirmation_evidence_context_not_found';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = v_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = v_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = v_attempt_id
  for update;

  select capability.* into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.id = v_capability_id
  for update;

  select callback_event.* into strict v_callback_event
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.request_state <> 'confirmation_processing'
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_request_state <> 'confirmation_processing'
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.request_state <> 'confirmation_processing'
     or v_capability.environment <> p_environment
     or v_capability.purpose <> 'confirm'
     or v_capability.claim_id <> p_callback_claim_id
     or v_capability.consumed_at is not null
     or v_capability.revoked_at is not null
     or v_capability.expires_at <= v_now
     or v_capability.claim_expires_at <= v_now
     or v_callback_event.environment <> p_environment
     or v_callback_event.purpose <> 'confirm'
     or v_callback_event.claim_id <> p_callback_claim_id
     or v_callback_event.claim_expires_at <= v_now then
    raise exception using
      errcode = '23514',
      message = 'line_pay_confirmation_evidence_contract_mismatch';
  end if;

  if v_callback_event.state = 'provider_verified' then
    if v_callback_event.provider_result_sha256 <> p_provider_result_sha256
       or v_callback_event.safe_result_code <> p_safe_result_code then
      raise exception using
        errcode = '23505',
        message = 'line_pay_confirmation_evidence_conflict';
    end if;

    return query select
      'already_recorded'::text,
      v_callback_event.id,
      v_callback_event.provider_result_sha256;
    return;
  end if;

  if v_callback_event.state <> 'claimed' then
    raise exception using
      errcode = '55000',
      message = 'line_pay_confirmation_evidence_invalid_state';
  end if;

  update public.line_pay_callback_events
  set state = 'provider_verified',
      provider_result_sha256 = p_provider_result_sha256,
      safe_result_code = p_safe_result_code,
      last_error_code = null
  where id = v_callback_event.id;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'confirmation_evidence_recorded',
    'confirmation_processing',
    'confirmation_processing',
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', p_safe_result_code,
      'evidence_sha256', p_provider_result_sha256
    )
  );

  return query select
    'recorded'::text,
    v_callback_event.id,
    p_provider_result_sha256;
end;
$$;

create or replace function public.complete_product_order_line_pay_confirmation(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_merchant_order_no text,
  p_transaction_id text,
  p_amount_twd integer,
  p_currency text,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_callback_claim_id uuid,
  p_confirm_result_sha256 text,
  p_request_id text,
  p_audit_evidence jsonb,
  p_paid_at timestamptz default null
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  transaction_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback_event public.line_pay_callback_events%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_completed_at timestamptz;
  v_audit_event_id uuid;
  v_row_count integer;
begin
  if p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_capability_id is null
     or p_callback_event_id is null
     or p_merchant_order_no is null
     or p_transaction_id is null
     or p_amount_twd is null
     or p_currency is null
     or p_confirm_result_sha256 is null
     or p_confirm_result_sha256 !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(p_merchant_order_no) not between 1 and 100
     or p_merchant_order_no ~ '[[:space:]]'
     or pg_catalog.length(p_transaction_id) not between 1 and 128
     or p_transaction_id ~ '[[:space:]]'
     or p_amount_twd <= 0
     or p_currency <> 'TWD'
     or p_callback_claim_id is null
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$'
     or not public.line_pay_audit_evidence_is_valid(p_audit_evidence)
     or p_audit_evidence <> pg_catalog.jsonb_build_object(
       'result_code', 'verified',
       'evidence_sha256', p_confirm_result_sha256
     )
     or p_paid_at is not null then
    raise exception using
      errcode = '22023',
      message = 'line_pay_confirmation_invalid_input';
  end if;

  -- Lock order is intentionally payment -> product order -> attempt -> capability.
  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = p_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = p_product_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select capability.* into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.id = p_capability_id
  for update;

  select callback_event.* into strict v_callback_event
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_payment.user_id <> v_order.user_id
     or v_payment.user_id <> v_attempt.user_id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.payment_id <> v_payment.id
     or v_attempt.product_order_id <> v_order.id
     or v_payment.merchant_order_no <> p_merchant_order_no
     or v_attempt.merchant_order_no <> p_merchant_order_no
     or v_payment.line_pay_transaction_id <> p_transaction_id
     or v_attempt.upstream_transaction_id <> p_transaction_id
     or v_payment.amount_twd <> p_amount_twd
     or v_order.total_amount_twd <> p_amount_twd
     or v_attempt.amount_twd <> p_amount_twd
     or v_payment.currency <> p_currency
     or v_order.currency <> p_currency
     or v_attempt.currency <> p_currency
     or v_capability.payment_id <> v_payment.id
     or v_capability.product_order_id <> v_order.id
     or v_capability.checkout_attempt_id <> v_attempt.id
     or v_capability.environment <> p_environment
     or v_capability.purpose <> 'confirm'
     or v_callback_event.capability_id <> v_capability.id
     or v_callback_event.payment_id <> v_payment.id
     or v_callback_event.product_order_id <> v_order.id
     or v_callback_event.checkout_attempt_id <> v_attempt.id
     or v_callback_event.environment <> p_environment
     or v_callback_event.purpose <> 'confirm'
     or v_callback_event.safe_result_code <> '0000'
     or v_callback_event.provider_result_sha256 <> p_confirm_result_sha256 then
    raise exception using
      errcode = '23514',
      message = 'line_pay_confirmation_contract_mismatch';
  end if;

  if v_payment.status = 'paid' then
    if v_payment.provider_trade_no <> p_transaction_id
       or v_order.payment_status <> 'paid'
       or v_order.order_status <> 'paid'
       or v_attempt.request_state <> 'paid'
       or v_capability.consumed_at is null
       or v_callback_event.state <> 'completed'
       or not exists (
         select 1
         from line_pay_private.line_pay_completion_proofs as proof
         where proof.payment_id = v_payment.id
           and proof.product_order_id = v_order.id
           and proof.checkout_attempt_id = v_attempt.id
           and proof.callback_event_id = v_callback_event.id
           and proof.capability_id = v_capability.id
           and proof.environment = p_environment
           and proof.merchant_order_no = p_merchant_order_no
           and proof.transaction_id = p_transaction_id
           and proof.amount_twd = p_amount_twd
           and proof.currency = p_currency
           and proof.provider_result_code = '0000'
           and proof.provider_result_sha256 = p_confirm_result_sha256
           and proof.completed_at = v_payment.paid_at
       ) then
      raise exception using
        errcode = '23514',
        message = 'line_pay_confirmation_paid_evidence_conflict';
    end if;

    return query select
      'already_completed'::text,
      v_payment.id,
      v_order.id,
      p_transaction_id;
    return;
  end if;

  if v_payment.status <> 'pending'
     or v_payment.request_state not in ('pending', 'confirmation_processing')
     or v_order.payment_status <> 'pending'
     or v_order.order_status <> 'payment_pending'
     or v_order.payment_request_state not in ('pending', 'confirmation_processing')
     or v_attempt.request_state not in ('succeeded', 'confirmation_processing') then
    raise exception using
      errcode = '55000',
      message = 'line_pay_confirmation_invalid_state';
  end if;

  if v_capability.consumed_at is not null
     or v_capability.revoked_at is not null
     or v_capability.expires_at <= v_now
     or v_capability.claim_id <> p_callback_claim_id
     or v_capability.claim_expires_at <= v_now
     or v_callback_event.state <> 'provider_verified'
     or v_callback_event.claim_id <> p_callback_claim_id
     or v_callback_event.claim_expires_at <= v_now then
    raise exception using
      errcode = '55000',
      message = 'line_pay_confirmation_capability_unavailable';
  end if;

  v_completed_at := v_now;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'confirmation_completed',
    v_payment.request_state,
    'paid',
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', '0000',
      'evidence_sha256', p_confirm_result_sha256
    )
  ) returning id into v_audit_event_id;

  insert into line_pay_private.line_pay_completion_proofs (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    callback_event_id,
    capability_id,
    environment,
    merchant_order_no,
    transaction_id,
    amount_twd,
    currency,
    provider_result_code,
    provider_result_sha256,
    audit_event_id,
    completed_at
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    v_callback_event.id,
    v_capability.id,
    p_environment,
    p_merchant_order_no,
    p_transaction_id,
    p_amount_twd,
    p_currency,
    '0000',
    p_confirm_result_sha256,
    v_audit_event_id,
    v_completed_at
  );

  update public.payments
  set status = 'paid',
      request_state = 'paid',
      provider_trade_no = p_transaction_id,
      paid_at = v_completed_at,
      reconciliation_required = false
  where id = v_payment.id
    and status = 'pending'
    and request_state in ('pending', 'confirmation_processing');

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_confirmation_payment_update_failed';
  end if;

  update public.product_orders
  set payment_status = 'paid',
      order_status = 'paid',
      payment_request_state = 'paid',
      reconciliation_required = false
  where id = v_order.id
    and payment_status = 'pending'
    and order_status = 'payment_pending';

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_confirmation_order_update_failed';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'paid',
      reconciliation_required = false,
      completed_at = v_completed_at
  where id = v_attempt.id
    and request_state in ('succeeded', 'confirmation_processing');

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_confirmation_attempt_update_failed';
  end if;

  update public.line_pay_callback_capabilities
  set consumed_at = v_completed_at
  where id = v_capability.id
    and consumed_at is null
    and revoked_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_confirmation_capability_consume_failed';
  end if;

  update public.line_pay_callback_events
  set state = 'completed',
      completed_at = v_completed_at
  where id = v_callback_event.id
    and state = 'provider_verified'
    and provider_result_sha256 = p_confirm_result_sha256;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_confirmation_callback_event_update_failed';
  end if;

  return query select
    'completed'::text,
    v_payment.id,
    v_order.id,
    p_transaction_id;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_confirmation_context_not_found';
end;
$$;

create or replace function public.cancel_product_order_line_pay_payment(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_callback_claim_id uuid,
  p_request_id text,
  p_reason_code text
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  request_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback_event public.line_pay_callback_events%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_row_count integer;
begin
  if p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_capability_id is null
     or p_callback_event_id is null
     or p_callback_claim_id is null
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$'
     or p_reason_code is null
     or p_reason_code !~ '^[a-z0-9_:-]{1,64}$'
     or p_reason_code ~ '^fake_test_(token|signature|authorization)_do_not_use$' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_cancel_invalid_input';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = p_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = p_product_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select capability.* into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.id = p_capability_id
  for update;

  select callback_event.* into strict v_callback_event
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.payment_id <> v_payment.id
     or v_attempt.product_order_id <> v_order.id
     or v_capability.payment_id <> v_payment.id
     or v_capability.product_order_id <> v_order.id
     or v_capability.checkout_attempt_id <> v_attempt.id
     or v_capability.environment <> p_environment
     or v_capability.purpose <> 'cancel'
     or v_callback_event.capability_id <> v_capability.id
     or v_callback_event.payment_id <> v_payment.id
     or v_callback_event.product_order_id <> v_order.id
     or v_callback_event.checkout_attempt_id <> v_attempt.id
     or v_callback_event.environment <> p_environment
     or v_callback_event.purpose <> 'cancel' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_cancel_contract_mismatch';
  end if;

  if (v_payment.status = 'paid' and p_reason_code <> 'cancel_after_paid')
     or (v_payment.status <> 'paid' and p_reason_code <> 'payment_canceled') then
    raise exception using
      errcode = '22023',
      message = 'line_pay_cancel_reason_state_mismatch';
  end if;

  if v_capability.consumed_at is not null then
    if v_payment.status = 'paid' then
      if v_callback_event.state <> 'completed' then
        raise exception using
          errcode = '23514',
          message = 'line_pay_cancel_callback_event_conflict';
      end if;

      return query select
        'already_paid'::text,
        v_payment.id,
        v_order.id,
        v_payment.request_state;
      return;
    end if;

    if v_payment.request_state = 'canceled'
       and v_order.order_status = 'canceled'
       and v_attempt.request_state = 'canceled'
       and v_callback_event.state = 'completed' then
      return query select
        'already_canceled'::text,
        v_payment.id,
        v_order.id,
        'canceled'::text;
      return;
    end if;

    raise exception using
      errcode = '55000',
      message = 'line_pay_cancel_consumed_capability_conflict';
  end if;

  if v_capability.revoked_at is not null
     or v_capability.expires_at <= v_now
     or v_capability.claim_id <> p_callback_claim_id
     or v_capability.claim_expires_at <= v_now
     or v_callback_event.state <> 'claimed'
     or v_callback_event.claim_id <> p_callback_claim_id
     or v_callback_event.claim_expires_at <= v_now then
    raise exception using
      errcode = '55000',
      message = 'line_pay_cancel_capability_unavailable';
  end if;

  if v_payment.status = 'paid' then
    update public.line_pay_callback_capabilities
    set consumed_at = v_now
    where id = v_capability.id
      and consumed_at is null;

    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'line_pay_cancel_after_paid_capability_consume_failed';
    end if;

    update public.line_pay_callback_events
    set state = 'completed',
        completed_at = v_now
    where id = v_callback_event.id
      and state = 'claimed';

    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'line_pay_cancel_after_paid_callback_event_update_failed';
    end if;

    insert into public.line_pay_payment_audit_events (
      payment_id,
      product_order_id,
      checkout_attempt_id,
      environment,
      event_type,
      from_state,
      to_state,
      request_id,
      evidence
    ) values (
      v_payment.id,
      v_order.id,
      v_attempt.id,
      p_environment,
      'cancel_after_paid',
      'paid',
      'paid',
      p_request_id,
      pg_catalog.jsonb_build_object(
        'result_code', 'cancel_after_paid',
        'payment_id', v_payment.id::text,
        'product_order_id', v_order.id::text,
        'checkout_attempt_id', v_attempt.id::text,
        'callback_event_id', v_callback_event.id::text,
        'capability_id', v_capability.id::text,
        'environment', p_environment,
        'merchant_order_no', v_payment.merchant_order_no,
        'amount_twd', v_payment.amount_twd::text,
        'currency', v_payment.currency,
        'event_type', 'cancel_after_paid',
        'from_state', 'paid',
        'to_state', 'paid',
        'request_state', v_payment.request_state,
        'reason_code', p_reason_code,
        'reconciliation_required', v_payment.reconciliation_required::text,
        'event_timestamp', v_now::text
      ) || case
        when v_payment.line_pay_transaction_id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'transaction_id', v_payment.line_pay_transaction_id
        )
      end
    );

    return query select
      'already_paid'::text,
      v_payment.id,
      v_order.id,
      v_payment.request_state;
    return;
  end if;

  if v_payment.request_state = 'reconciliation_required'
     or v_attempt.request_state in ('unknown', 'reconciliation_required')
     or v_order.reconciliation_required then
    raise exception using
      errcode = '55000',
      message = 'line_pay_cancel_reconciliation_required';
  end if;

  if v_payment.request_state not in ('initialized', 'requesting', 'pending')
     or v_order.order_status not in ('pending_payment', 'payment_requesting', 'payment_pending')
     or v_attempt.request_state not in ('initialized', 'queued', 'claimed', 'requesting', 'pending', 'succeeded') then
    raise exception using
      errcode = '55000',
      message = 'line_pay_cancel_invalid_state';
  end if;

  update public.payments
  set status = 'cancelled',
      request_state = 'canceled',
      reconciliation_required = false
  where id = v_payment.id
    and status <> 'paid';

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_cancel_payment_update_failed';
  end if;

  update public.product_orders
  set payment_status = 'canceled',
      order_status = 'canceled',
      payment_request_state = 'canceled',
      reconciliation_required = false
  where id = v_order.id
    and payment_status <> 'paid';

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_cancel_order_update_failed';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'canceled',
      reconciliation_required = false,
      completed_at = coalesce(completed_at, v_now)
  where id = v_attempt.id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_cancel_attempt_update_failed';
  end if;

  update public.line_pay_callback_capabilities
  set consumed_at = v_now
  where id = v_capability.id
    and consumed_at is null
    and revoked_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_cancel_capability_consume_failed';
  end if;

  update public.line_pay_callback_events
  set state = 'completed',
      completed_at = v_now
  where id = v_callback_event.id
    and state = 'claimed';

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_cancel_callback_event_update_failed';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'payment_canceled',
    v_payment.request_state,
    'canceled',
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', 'canceled',
      'payment_id', v_payment.id::text,
      'product_order_id', v_order.id::text,
      'checkout_attempt_id', v_attempt.id::text,
      'callback_event_id', v_callback_event.id::text,
      'capability_id', v_capability.id::text,
      'environment', p_environment,
      'merchant_order_no', v_payment.merchant_order_no,
      'amount_twd', v_payment.amount_twd::text,
      'currency', v_payment.currency,
      'event_type', 'payment_canceled',
      'from_state', v_payment.request_state,
      'to_state', 'canceled',
      'request_state', 'canceled',
      'reason_code', p_reason_code,
      'reconciliation_required', 'false',
      'event_timestamp', v_now::text
    ) || case
      when v_payment.line_pay_transaction_id is null then '{}'::jsonb
      else pg_catalog.jsonb_build_object(
        'transaction_id', v_payment.line_pay_transaction_id
      )
    end
  );

  return query select
    'canceled'::text,
    v_payment.id,
    v_order.id,
    'canceled'::text;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_cancel_context_not_found';
end;
$$;

create or replace function public.mark_product_order_line_pay_reconciliation(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_reason_code text,
  p_request_id text
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  request_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_callback_event public.line_pay_callback_events%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_target_state text;
  v_row_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_environment is null
     or p_environment not in ('sandbox', 'production')
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_reason_code is null
     or p_reason_code !~ '^[a-z0-9_:-]{1,64}$'
     or p_reason_code ~ '^fake_test_(token|signature|authorization)_do_not_use$'
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_reconciliation_invalid_input';
  end if;

  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = p_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = p_product_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.payment_id <> v_payment.id
     or v_attempt.product_order_id <> v_order.id then
    raise exception using
      errcode = '23514',
      message = 'line_pay_reconciliation_contract_mismatch';
  end if;

  if v_payment.reconciliation_required
     and v_order.reconciliation_required
     and v_attempt.reconciliation_required then
    return query select
      'already_marked'::text,
      v_payment.id,
      v_order.id,
      v_attempt.request_state;
    return;
  end if;

  if v_attempt.request_state in ('paid', 'canceled') then
    v_target_state := v_attempt.request_state;
  else
    v_target_state := 'reconciliation_required';
  end if;

  select callback_event.* into v_callback_event
  from public.line_pay_callback_events as callback_event
  where callback_event.checkout_attempt_id = v_attempt.id
    and callback_event.state in ('claimed', 'provider_verified')
  order by callback_event.created_at, callback_event.id
  limit 1
  for update;

  if v_callback_event.id is not null then
    select capability.* into strict v_capability
    from public.line_pay_callback_capabilities as capability
    where capability.id = v_callback_event.capability_id
    for update;
  end if;

  update public.payments as payment
  set request_state = case
        when payment.request_state in ('paid', 'canceled') then payment.request_state
        else 'reconciliation_required'
      end,
      reconciliation_required = true
  where payment.id = v_payment.id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_reconciliation_payment_update_failed';
  end if;

  update public.product_orders as product_order
  set payment_request_state = case
        when product_order.payment_request_state in ('paid', 'canceled') then product_order.payment_request_state
        else 'reconciliation_required'
      end,
      reconciliation_required = true
  where product_order.id = v_order.id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_reconciliation_order_update_failed';
  end if;

  update public.line_pay_checkout_attempts as checkout_attempt
  set request_state = v_target_state,
      reconciliation_required = true,
      last_error_code = p_reason_code
  where checkout_attempt.id = v_attempt.id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_reconciliation_attempt_update_failed';
  end if;

  update public.line_pay_callback_events as callback_event
  set state = 'reconciliation_required',
      last_error_code = p_reason_code
  where callback_event.checkout_attempt_id = v_attempt.id
    and callback_event.state in ('claimed', 'provider_verified');

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    error_code,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'reconciliation_required',
    v_attempt.request_state,
    v_target_state,
    p_reason_code,
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', 'reconciliation_required',
      'provider_status', 'reconciliation_required',
      'payment_id', v_payment.id::text,
      'product_order_id', v_order.id::text,
      'checkout_attempt_id', v_attempt.id::text,
      'environment', p_environment,
      'merchant_order_no', v_payment.merchant_order_no,
      'amount_twd', v_payment.amount_twd::text,
      'currency', v_payment.currency,
      'event_type', 'reconciliation_required',
      'from_state', v_attempt.request_state,
      'to_state', v_target_state,
      'request_state', v_target_state,
      'reason_code', p_reason_code,
      'reconciliation_required', 'true',
      'event_timestamp', v_now::text
    )
      || case
        when v_payment.line_pay_transaction_id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'transaction_id', v_payment.line_pay_transaction_id
        )
      end
      || case
        when v_callback_event.id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'callback_event_id', v_callback_event.id::text,
          'capability_id', v_capability.id::text
        )
      end
  );

  return query select
    'marked'::text,
    v_payment.id,
    v_order.id,
    v_target_state;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_reconciliation_context_not_found';
end;
$$;

-- Dedicated roles are accepted only when absent or at an exact zero-extra-
-- privilege baseline. Normal cluster-wide PUBLIC defaults are not role-owned
-- privileges; memberships and every explicit ACL/ownership category are
-- checked before the roles are used for any owner or grant operation.
do $$
declare
  v_role_name text;
  v_role_oid oid;
begin
  foreach v_role_name in array array[
    'line_pay_payment_executor',
    'line_pay_payment_function_owner'
  ]::text[] loop
    select role.oid into v_role_oid
    from pg_catalog.pg_roles as role
    where role.rolname = v_role_name;

    if v_role_oid is null then
      continue;
    end if;

    -- line_pay_role_guard:attributes
    if exists (
      select 1
      from pg_catalog.pg_roles as role
      where role.oid = v_role_oid
        and (
          role.rolcanlogin
          or role.rolinherit
          or role.rolsuper
          or role.rolcreatedb
          or role.rolcreaterole
          or role.rolreplication
          or role.rolbypassrls
          or role.rolconnlimit <> -1
          or role.rolconfig is not null
          or role.rolvaliduntil is not null
        )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_role_attribute_conflict';
    end if;

    -- line_pay_role_guard:membership
    if exists (
      select 1
      from pg_catalog.pg_auth_members as membership
      where membership.roleid = v_role_oid
         or membership.member = v_role_oid
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_role_membership_conflict';
    end if;

    -- line_pay_role_guard:database
    if exists (
      select 1
      from pg_catalog.pg_database as database
      where database.datdba = v_role_oid
         or exists (
           select 1
           from pg_catalog.aclexplode(database.datacl) as acl
           where acl.grantee = v_role_oid
         )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_database_privilege_conflict';
    end if;

    -- line_pay_role_guard:schema
    if exists (
      select 1
      from pg_catalog.pg_namespace as namespace
      where namespace.nspowner = v_role_oid
         or exists (
           select 1
           from pg_catalog.aclexplode(namespace.nspacl) as acl
           where acl.grantee = v_role_oid
         )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_schema_privilege_conflict';
    end if;

    -- line_pay_role_guard:relation
    if exists (
      select 1
      from pg_catalog.pg_class as relation
      where relation.relkind in ('r', 'p', 'v', 'm', 'f')
        and (
          relation.relowner = v_role_oid
          or exists (
            select 1
            from pg_catalog.aclexplode(relation.relacl) as acl
            where acl.grantee = v_role_oid
          )
          or exists (
            select 1
            from pg_catalog.pg_attribute as attribute
            cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
            where attribute.attrelid = relation.oid
              and attribute.attnum > 0
              and not attribute.attisdropped
              and acl.grantee = v_role_oid
          )
        )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_relation_privilege_conflict';
    end if;

    -- line_pay_role_guard:sequence
    if exists (
      select 1
      from pg_catalog.pg_class as sequence
      where sequence.relkind = 'S'
        and (
          sequence.relowner = v_role_oid
          or exists (
            select 1
            from pg_catalog.aclexplode(sequence.relacl) as acl
            where acl.grantee = v_role_oid
          )
        )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_sequence_privilege_conflict';
    end if;

    -- line_pay_role_guard:function
    if exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.prokind in ('f', 'p')
        and (
          procedure.proowner = v_role_oid
          or exists (
            select 1
            from pg_catalog.aclexplode(procedure.proacl) as acl
            where acl.grantee = v_role_oid
          )
        )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_function_privilege_conflict';
    end if;

    -- line_pay_role_guard:type
    if exists (
      select 1
      from pg_catalog.pg_type as type_row
      where type_row.typtype in ('b', 'c', 'd', 'e', 'r', 'm')
        and (
          type_row.typowner = v_role_oid
          or exists (
            select 1
            from pg_catalog.aclexplode(type_row.typacl) as acl
            where acl.grantee = v_role_oid
          )
        )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_type_privilege_conflict';
    end if;

    -- line_pay_role_guard:default_acl
    if exists (
      select 1
      from pg_catalog.pg_default_acl as default_acl
      where default_acl.defaclrole = v_role_oid
         or exists (
           select 1
           from pg_catalog.aclexplode(default_acl.defaclacl) as acl
           where acl.grantee = v_role_oid
         )
    ) then
      raise exception using errcode = '42501',
        message = v_role_name || '_default_privilege_conflict';
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'line_pay_payment_executor'
  ) then
    create role line_pay_payment_executor
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'line_pay_payment_function_owner'
  ) then
    create role line_pay_payment_function_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

create schema line_pay_private authorization line_pay_payment_function_owner;

revoke all on schema line_pay_private
from public, anon, authenticated, service_role, line_pay_payment_executor;

create table line_pay_private.line_pay_completion_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  product_order_id uuid not null unique references public.product_orders(id) on delete restrict,
  checkout_attempt_id uuid not null unique references public.line_pay_checkout_attempts(id) on delete restrict,
  callback_event_id uuid not null unique references public.line_pay_callback_events(id) on delete restrict,
  capability_id uuid not null unique references public.line_pay_callback_capabilities(id) on delete restrict,
  environment text not null,
  merchant_order_no text not null,
  transaction_id text not null,
  amount_twd integer not null,
  currency text not null,
  provider_result_code text not null,
  provider_result_sha256 text not null,
  audit_event_id uuid not null unique references public.line_pay_payment_audit_events(id) on delete restrict,
  completed_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint line_pay_completion_proofs_environment_check
    check (environment in ('sandbox', 'production')),
  constraint line_pay_completion_proofs_merchant_order_check
    check (merchant_order_no ~ '^[A-Za-z0-9_:-]{1,100}$'),
  constraint line_pay_completion_proofs_transaction_check
    check (transaction_id ~ '^[A-Za-z0-9_:-]{1,128}$'),
  constraint line_pay_completion_proofs_amount_check check (amount_twd > 0),
  constraint line_pay_completion_proofs_currency_check check (currency = 'TWD'),
  constraint line_pay_completion_proofs_result_code_check check (provider_result_code = '0000'),
  constraint line_pay_completion_proofs_result_hash_check
    check (provider_result_sha256 ~ '^[0-9a-f]{64}$')
);

alter table line_pay_private.line_pay_completion_proofs
  owner to line_pay_payment_function_owner;
alter table line_pay_private.line_pay_completion_proofs enable row level security;

revoke all on table line_pay_private.line_pay_completion_proofs
from public, anon, authenticated, service_role, line_pay_payment_executor;

create or replace function line_pay_private.line_pay_enforce_completion_proof()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_completion_proof_is_immutable';
  end if;

  if current_user <> 'line_pay_payment_function_owner' then
    raise exception using
      errcode = '42501',
      message = 'line_pay_completion_proof_requires_function_owner';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order
      on product_order.id = new.product_order_id
    join public.line_pay_checkout_attempts as attempt
      on attempt.id = new.checkout_attempt_id
    join public.line_pay_callback_capabilities as capability
      on capability.id = new.capability_id
    join public.line_pay_callback_events as callback_event
      on callback_event.id = new.callback_event_id
    join public.line_pay_payment_audit_events as audit_event
      on audit_event.id = new.audit_event_id
    where payment.id = new.payment_id
      and payment.provider = 'line_pay'
      and payment.status = 'pending'
      and payment.request_state = 'confirmation_processing'
      and payment.product_order_id = product_order.id
      and payment.checkout_attempt_id = attempt.id
      and payment.environment = new.environment
      and payment.merchant_order_no = new.merchant_order_no
      and payment.line_pay_transaction_id = new.transaction_id
      and payment.amount_twd = new.amount_twd
      and payment.currency = new.currency
      and product_order.payment_method = 'line_pay'
      and product_order.payment_status = 'pending'
      and product_order.order_status = 'payment_pending'
      and product_order.payment_request_state = 'confirmation_processing'
      and product_order.payment_id = payment.id
      and product_order.checkout_attempt_id = attempt.id
      and product_order.environment = new.environment
      and product_order.total_amount_twd = new.amount_twd
      and product_order.currency = new.currency
      and attempt.provider = 'line_pay'
      and attempt.request_state = 'confirmation_processing'
      and attempt.payment_id = payment.id
      and attempt.product_order_id = product_order.id
      and attempt.environment = new.environment
      and attempt.merchant_order_no = new.merchant_order_no
      and attempt.upstream_transaction_id = new.transaction_id
      and attempt.amount_twd = new.amount_twd
      and attempt.currency = new.currency
      and capability.payment_id = payment.id
      and capability.product_order_id = product_order.id
      and capability.checkout_attempt_id = attempt.id
      and capability.environment = new.environment
      and capability.purpose = 'confirm'
      and capability.consumed_at is null
      and capability.revoked_at is null
      and capability.claim_id is not null
      and capability.claim_expires_at > pg_catalog.clock_timestamp()
      and callback_event.capability_id = capability.id
      and callback_event.payment_id = payment.id
      and callback_event.product_order_id = product_order.id
      and callback_event.checkout_attempt_id = attempt.id
      and callback_event.environment = new.environment
      and callback_event.purpose = 'confirm'
      and callback_event.state = 'provider_verified'
      and callback_event.claim_id = capability.claim_id
      and callback_event.claim_expires_at > pg_catalog.clock_timestamp()
      and callback_event.safe_result_code = new.provider_result_code
      and callback_event.provider_result_sha256 = new.provider_result_sha256
      and audit_event.payment_id = payment.id
      and audit_event.product_order_id = product_order.id
      and audit_event.checkout_attempt_id = attempt.id
      and audit_event.environment = new.environment
      and audit_event.event_type = 'confirmation_completed'
      and audit_event.to_state = 'paid'
      and audit_event.evidence = pg_catalog.jsonb_build_object(
        'result_code', '0000',
        'evidence_sha256', new.provider_result_sha256
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_completion_proof_contract_mismatch';
  end if;

  return new;
end;
$$;

alter function line_pay_private.line_pay_enforce_completion_proof()
  owner to line_pay_payment_function_owner;
revoke execute on function line_pay_private.line_pay_enforce_completion_proof()
from public, anon, authenticated, service_role, line_pay_payment_executor;

create trigger line_pay_completion_proofs_guard
before insert or update or delete on line_pay_private.line_pay_completion_proofs
for each row execute function line_pay_private.line_pay_enforce_completion_proof();

grant usage on schema public, line_pay_private to line_pay_payment_function_owner;
grant usage on schema public to line_pay_payment_executor;
grant usage on schema line_pay_private to service_role;

grant select on table
  public.payments,
  public.product_orders,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events,
  public.line_pay_payment_audit_events
to line_pay_payment_function_owner;

grant update (
  status,
  request_state,
  provider_trade_no,
  paid_at,
  reconciliation_required,
  line_pay_transaction_id,
  failure_reason
)
on table public.payments to line_pay_payment_function_owner;
grant update (payment_status, order_status, payment_request_state, reconciliation_required)
on table public.product_orders to line_pay_payment_function_owner;
grant update (
  request_state,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at,
  upstream_transaction_id,
  sanitized_result,
  last_error_code,
  reconciliation_required,
  completed_at
)
on table public.line_pay_checkout_attempts to line_pay_payment_function_owner;
grant update (
  state,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at,
  last_error_code,
  completed_at
)
on table public.line_pay_request_outbox to line_pay_payment_function_owner;
grant update (consumed_at)
on table public.line_pay_callback_capabilities to line_pay_payment_function_owner;
grant update (state, provider_result_sha256, safe_result_code, last_error_code, completed_at)
on table public.line_pay_callback_events to line_pay_payment_function_owner;
grant insert on table public.line_pay_payment_audit_events to line_pay_payment_function_owner;
grant select, insert on table line_pay_private.line_pay_completion_proofs
to line_pay_payment_function_owner;
grant select on table line_pay_private.line_pay_completion_proofs to service_role;

create policy line_pay_payment_function_owner_payments_select
on public.payments for select to line_pay_payment_function_owner
using (provider = 'line_pay');
create policy line_pay_payment_function_owner_payments_update
on public.payments for update to line_pay_payment_function_owner
using (provider = 'line_pay') with check (provider = 'line_pay');
create policy line_pay_payment_function_owner_orders_select
on public.product_orders for select to line_pay_payment_function_owner
using (payment_method = 'line_pay');
create policy line_pay_payment_function_owner_orders_update
on public.product_orders for update to line_pay_payment_function_owner
using (payment_method = 'line_pay') with check (payment_method = 'line_pay');
create policy line_pay_payment_function_owner_attempts_select
on public.line_pay_checkout_attempts for select to line_pay_payment_function_owner
using (provider = 'line_pay');
create policy line_pay_payment_function_owner_attempts_update
on public.line_pay_checkout_attempts for update to line_pay_payment_function_owner
using (provider = 'line_pay') with check (provider = 'line_pay');
create policy line_pay_payment_function_owner_outbox_select
on public.line_pay_request_outbox for select to line_pay_payment_function_owner
using (provider = 'line_pay');
create policy line_pay_payment_function_owner_outbox_update
on public.line_pay_request_outbox for update to line_pay_payment_function_owner
using (provider = 'line_pay') with check (provider = 'line_pay');
create policy line_pay_payment_function_owner_capabilities_select
on public.line_pay_callback_capabilities for select to line_pay_payment_function_owner
using (purpose in ('confirm', 'cancel'));
create policy line_pay_payment_function_owner_capabilities_update
on public.line_pay_callback_capabilities for update to line_pay_payment_function_owner
using (purpose in ('confirm', 'cancel')) with check (purpose in ('confirm', 'cancel'));
create policy line_pay_payment_function_owner_events_select
on public.line_pay_callback_events for select to line_pay_payment_function_owner
using (purpose in ('confirm', 'cancel'));
create policy line_pay_payment_function_owner_events_update
on public.line_pay_callback_events for update to line_pay_payment_function_owner
using (purpose in ('confirm', 'cancel')) with check (purpose in ('confirm', 'cancel'));
create policy line_pay_payment_function_owner_audit_select
on public.line_pay_payment_audit_events for select to line_pay_payment_function_owner
using (event_type in (
  'request_claim_expired',
  'request_claimed',
  'request_succeeded',
  'request_failed',
  'request_unknown',
  'confirmation_claimed',
  'confirmation_evidence_recorded',
  'confirmation_completed',
  'cancel_after_paid',
  'payment_canceled',
  'reconciliation_required'
));
create policy line_pay_payment_function_owner_audit_insert
on public.line_pay_payment_audit_events for insert to line_pay_payment_function_owner
with check (event_type in (
  'request_claim_expired',
  'request_claimed',
  'request_succeeded',
  'request_failed',
  'request_unknown',
  'confirmation_claimed',
  'confirmation_evidence_recorded',
  'confirmation_completed',
  'cancel_after_paid',
  'payment_canceled',
  'reconciliation_required'
));

grant create on schema public to line_pay_payment_function_owner;
alter function public.claim_product_order_line_pay_request(
  uuid, text, text, text, uuid, timestamptz
) owner to line_pay_payment_function_owner;
alter function public.record_product_order_line_pay_request_success(
  uuid, text, text, text, uuid, text, text, jsonb, text
) owner to line_pay_payment_function_owner;
alter function public.record_product_order_line_pay_request_failure(
  uuid, text, text, text, uuid, text, text
) owner to line_pay_payment_function_owner;
alter function public.mark_product_order_line_pay_request_unknown(
  uuid, text, text, text, uuid, text, text
) owner to line_pay_payment_function_owner;
alter function public.claim_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) owner to line_pay_payment_function_owner;
alter function public.record_product_order_line_pay_confirmation_evidence(
  text, uuid, uuid, text, text, text
) owner to line_pay_payment_function_owner;
alter function public.complete_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamptz
) owner to line_pay_payment_function_owner;
alter function public.cancel_product_order_line_pay_payment(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) owner to line_pay_payment_function_owner;
alter function public.mark_product_order_line_pay_reconciliation(
  text, uuid, uuid, uuid, text, text
) owner to line_pay_payment_function_owner;
revoke create on schema public from line_pay_payment_function_owner;

grant execute on function public.line_pay_audit_evidence_is_valid(jsonb)
to line_pay_payment_function_owner;
grant execute on function public.line_pay_sanitized_result_is_valid(jsonb)
to line_pay_payment_function_owner;

revoke execute on function public.claim_product_order_line_pay_request(
  uuid, text, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.record_product_order_line_pay_request_success(
  uuid, text, text, text, uuid, text, text, jsonb, text
) from public, anon, authenticated;
revoke execute on function public.record_product_order_line_pay_request_failure(
  uuid, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.mark_product_order_line_pay_request_unknown(
  uuid, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.read_product_order_line_pay_request_result(
  uuid, text, text, text
) from public, anon, authenticated;
revoke execute on function public.claim_line_pay_callback_capability(
  text, text, text, uuid, uuid, uuid, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.claim_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.record_product_order_line_pay_confirmation_evidence(
  text, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke execute on function public.complete_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke execute on function public.cancel_product_order_line_pay_payment(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.mark_product_order_line_pay_reconciliation(
  text, uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.claim_product_order_line_pay_request(
  uuid, text, text, text, uuid, timestamptz
) to service_role;
grant execute on function public.record_product_order_line_pay_request_success(
  uuid, text, text, text, uuid, text, text, jsonb, text
) to service_role;
grant execute on function public.record_product_order_line_pay_request_failure(
  uuid, text, text, text, uuid, text, text
) to service_role;
grant execute on function public.mark_product_order_line_pay_request_unknown(
  uuid, text, text, text, uuid, text, text
) to service_role;
grant execute on function public.read_product_order_line_pay_request_result(
  uuid, text, text, text
) to service_role;
grant execute on function public.claim_line_pay_callback_capability(
  text, text, text, uuid, uuid, uuid, uuid, timestamptz
) to service_role;
grant execute on function public.claim_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.record_product_order_line_pay_confirmation_evidence(
  text, uuid, uuid, text, text, text
) to line_pay_payment_executor;
grant execute on function public.complete_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamptz
) to line_pay_payment_executor;
grant execute on function public.cancel_product_order_line_pay_payment(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.mark_product_order_line_pay_reconciliation(
  text, uuid, uuid, uuid, text, text
) to service_role;

-- Exact postcondition: one reviewed signature per sensitive name, fixed owner,
-- fixed SECURITY DEFINER boundary, empty search_path, and no unexpected caller.
do $$
declare
  v_expected_count integer;
  v_actual_count integer;
begin
  with expected(
    function_name,
    argument_types,
    owner_name,
    security_definer,
    caller_name
  ) as (
    values
      ('claim_product_order_line_pay_request', 'uuid, text, text, text, uuid, timestamp with time zone', 'line_pay_payment_function_owner', true, 'service_role'),
      ('record_product_order_line_pay_request_success', 'uuid, text, text, text, uuid, text, text, jsonb, text', 'line_pay_payment_function_owner', true, 'service_role'),
      ('record_product_order_line_pay_request_failure', 'uuid, text, text, text, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
      ('mark_product_order_line_pay_request_unknown', 'uuid, text, text, text, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
      ('read_product_order_line_pay_request_result', 'uuid, text, text, text', current_user, false, 'service_role'),
      ('claim_line_pay_callback_capability', 'text, text, text, uuid, uuid, uuid, uuid, timestamp with time zone', current_user, false, 'service_role'),
      ('claim_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
      ('record_product_order_line_pay_confirmation_evidence', 'text, uuid, uuid, text, text, text', 'line_pay_payment_function_owner', true, 'line_pay_payment_executor'),
      ('complete_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamp with time zone', 'line_pay_payment_function_owner', true, 'line_pay_payment_executor'),
      ('cancel_product_order_line_pay_payment', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
      ('mark_product_order_line_pay_reconciliation', 'text, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role')
  ), actual as (
    select
      procedure.oid,
      procedure.proname as function_name,
      pg_catalog.oidvectortypes(procedure.proargtypes) as argument_types,
      owner.rolname as owner_name,
      procedure.prosecdef as security_definer,
      procedure.proconfig,
      procedure.proacl
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname in (select expected.function_name from expected)
  )
  select
    (select pg_catalog.count(*) from expected),
    (select pg_catalog.count(*) from actual)
  into v_expected_count, v_actual_count;

  if v_actual_count <> v_expected_count then
    raise exception using errcode = '42710',
      message = 'line_pay_sensitive_rpc_overload_postcondition_failed';
  end if;

  if exists (
    with expected(
      function_name,
      argument_types,
      owner_name,
      security_definer,
      caller_name
    ) as (
      values
        ('claim_product_order_line_pay_request', 'uuid, text, text, text, uuid, timestamp with time zone', 'line_pay_payment_function_owner', true, 'service_role'),
        ('record_product_order_line_pay_request_success', 'uuid, text, text, text, uuid, text, text, jsonb, text', 'line_pay_payment_function_owner', true, 'service_role'),
        ('record_product_order_line_pay_request_failure', 'uuid, text, text, text, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
        ('mark_product_order_line_pay_request_unknown', 'uuid, text, text, text, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
        ('read_product_order_line_pay_request_result', 'uuid, text, text, text', current_user, false, 'service_role'),
        ('claim_line_pay_callback_capability', 'text, text, text, uuid, uuid, uuid, uuid, timestamp with time zone', current_user, false, 'service_role'),
        ('claim_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
        ('record_product_order_line_pay_confirmation_evidence', 'text, uuid, uuid, text, text, text', 'line_pay_payment_function_owner', true, 'line_pay_payment_executor'),
        ('complete_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamp with time zone', 'line_pay_payment_function_owner', true, 'line_pay_payment_executor'),
        ('cancel_product_order_line_pay_payment', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role'),
        ('mark_product_order_line_pay_reconciliation', 'text, uuid, uuid, uuid, text, text', 'line_pay_payment_function_owner', true, 'service_role')
    )
    select 1
    from expected
    left join pg_catalog.pg_proc as procedure
      on procedure.proname = expected.function_name
     and pg_catalog.oidvectortypes(procedure.proargtypes) = expected.argument_types
    left join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
     and namespace.nspname = 'public'
    left join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where procedure.oid is null
       or namespace.oid is null
       or owner.rolname <> expected.owner_name
       or procedure.prosecdef <> expected.security_definer
       or procedure.proconfig is null
       or not ('search_path=""' = any (procedure.proconfig))
       or exists (
         select 1
         from pg_catalog.aclexplode(procedure.proacl) as public_acl
         where public_acl.grantee = 0
           and public_acl.privilege_type = 'EXECUTE'
       )
       or pg_catalog.has_function_privilege('anon', procedure.oid, 'execute')
       or pg_catalog.has_function_privilege('authenticated', procedure.oid, 'execute')
       or not pg_catalog.has_function_privilege(expected.caller_name, procedure.oid, 'execute')
       or (
         expected.caller_name <> 'service_role'
         and pg_catalog.has_function_privilege('service_role', procedure.oid, 'execute')
       )
       or (
         expected.caller_name <> 'line_pay_payment_executor'
         and pg_catalog.has_function_privilege('line_pay_payment_executor', procedure.oid, 'execute')
       )
       or exists (
         select 1
         from pg_catalog.aclexplode(procedure.proacl) as acl
         where acl.privilege_type = 'EXECUTE'
           and acl.grantee not in (
             procedure.proowner,
             (select role.oid from pg_catalog.pg_roles as role where role.rolname = expected.caller_name)
           )
       )
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_sensitive_rpc_security_postcondition_failed';
  end if;
end
$$;

-- Exact role postcondition for the sensitive boundary.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles as role
    where role.rolname in ('line_pay_payment_executor', 'line_pay_payment_function_owner')
      and (
        role.rolcanlogin
        or role.rolinherit
        or role.rolsuper
        or role.rolcreatedb
        or role.rolcreaterole
        or role.rolreplication
        or role.rolbypassrls
        or role.rolconnlimit <> -1
        or role.rolconfig is not null
        or role.rolvaliduntil is not null
      )
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_dedicated_role_attribute_postcondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
    where granted_role.rolname in ('line_pay_payment_executor', 'line_pay_payment_function_owner')
       or member_role.rolname in ('line_pay_payment_executor', 'line_pay_payment_function_owner')
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_dedicated_role_membership_postcondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_roles as owner on owner.oid = relation.relowner
    where owner.rolname = 'line_pay_payment_executor'
  ) or exists (
    select 1
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
    where grantee.rolname = 'line_pay_payment_executor'
  ) or exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
    join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
    where grantee.rolname = 'line_pay_payment_executor'
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_executor_relation_privilege_postcondition_failed';
  end if;

  if pg_catalog.has_schema_privilege('line_pay_payment_executor', 'public', 'create')
     or pg_catalog.has_schema_privilege('line_pay_payment_executor', 'line_pay_private', 'usage')
     or not pg_catalog.has_schema_privilege('line_pay_payment_executor', 'public', 'usage') then
    raise exception using errcode = '42501',
      message = 'line_pay_executor_schema_privilege_postcondition_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'claim_product_order_line_pay_request',
        'record_product_order_line_pay_request_success',
        'record_product_order_line_pay_request_failure',
        'mark_product_order_line_pay_request_unknown',
        'read_product_order_line_pay_request_result',
        'claim_line_pay_callback_capability',
        'claim_product_order_line_pay_confirmation',
        'record_product_order_line_pay_confirmation_evidence',
        'complete_product_order_line_pay_confirmation',
        'cancel_product_order_line_pay_payment',
        'mark_product_order_line_pay_reconciliation'
      )
      and pg_catalog.has_function_privilege('line_pay_payment_executor', procedure.oid, 'execute')
  ) <> 2 then
    raise exception using errcode = '42501',
      message = 'line_pay_executor_rpc_allowlist_postcondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    join pg_catalog.pg_roles as owner on owner.oid = namespace.nspowner
    where owner.rolname = 'line_pay_payment_function_owner'
      and namespace.nspname <> 'line_pay_private'
  ) or exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    join pg_catalog.pg_roles as owner on owner.oid = relation.relowner
    where owner.rolname = 'line_pay_payment_function_owner'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and not (
        namespace.nspname = 'line_pay_private'
        and relation.relname = 'line_pay_completion_proofs'
      )
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_function_owner_object_allowlist_postcondition_failed';
  end if;

  if pg_catalog.has_table_privilege(
       'service_role',
       'public.line_pay_payment_audit_events',
       'select,insert,update,delete,truncate,references,trigger'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_executor',
       'public.payments',
       'select,insert,update,delete,truncate,references,trigger'
     ) then
    raise exception using errcode = '42501',
      message = 'line_pay_audit_or_executor_dml_postcondition_failed';
  end if;
end
$$;

commit;
