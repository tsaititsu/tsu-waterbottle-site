\set ON_ERROR_STOP on

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

set role service_role;

create temporary table line_pay_initialization_payload (
  payload jsonb not null
) on commit preserve rows;

insert into line_pay_initialization_payload (payload)
values (
  pg_catalog.jsonb_build_object(
    'user_id', '41000000-0000-4000-8000-000000000001',
    'environment', 'sandbox',
    'order_no', 'PO-SANDBOX-ATOMIC-1',
    'merchant_order_no', 'LP_SANDBOX_ATOMIC_1',
    'customer_name', 'Sandbox Tester',
    'customer_email', 'sandbox@example.test',
    'customer_phone', null,
    'note', 'synthetic sandbox contract',
    'items', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_slug', 'sandbox-contract-item',
        'product_name', 'Sandbox contract item',
        'unit_price_twd', 40,
        'quantity', 2,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'slug', 'sandbox-contract-item',
          'name', 'Sandbox contract item',
          'category', '符咒商品',
          'priceTwd', 40
        )
      ),
      pg_catalog.jsonb_build_object(
        'product_slug', 'sandbox-contract-addon',
        'product_name', 'Sandbox contract addon',
        'unit_price_twd', 20,
        'quantity', 1,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'slug', 'sandbox-contract-addon',
          'name', 'Sandbox contract addon',
          'category', '符咒商品',
          'priceTwd', 20
        )
      )
    ),
    'shipping_info', pg_catalog.jsonb_build_object(
      'recipient_name', null,
      'recipient_phone', null,
      'recipient_email', null,
      'shipping_method', 'manual',
      'postal_code', null,
      'address', null,
      'store_type', null,
      'store_id', null,
      'store_name', null,
      'store_address', null,
      'store_phone', null
    ),
    'idempotency_key', 'sandbox-atomic-idempotency-0001',
    'request_body_sha256', pg_catalog.repeat('a', 64),
    'confirm_token_hash', pg_catalog.repeat('b', 64),
    'cancel_token_hash', pg_catalog.repeat('c', 64),
    'capability_expires_at',
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() + interval '30 minutes',
        'YYYY-MM-DD"T"HH24:MI:SS.USOF'
      )
  )
);

create temporary table line_pay_initialization_first_result
on commit preserve rows
as
select *
from public.initialize_product_order_line_pay_checkout(
  (select payload from line_pay_initialization_payload)
);

create temporary table line_pay_initialization_replay_result
on commit preserve rows
as
select *
from public.initialize_product_order_line_pay_checkout(
  (select payload from line_pay_initialization_payload)
);

do $$
declare
  v_first record;
  v_replay record;
begin
  select * into strict v_first
  from line_pay_initialization_first_result;

  select * into strict v_replay
  from line_pay_initialization_replay_result;

  if v_first.result_code <> 'initialized'
     or v_first.request_state <> 'queued'
     or v_replay.result_code <> 'already_initialized'
     or v_replay.request_state <> 'queued'
     or v_first.product_order_id <> v_replay.product_order_id
     or v_first.payment_id <> v_replay.payment_id
     or v_first.attempt_id <> v_replay.attempt_id
     or v_first.outbox_id <> v_replay.outbox_id
     or v_first.confirm_capability_id <> v_replay.confirm_capability_id
     or v_first.cancel_capability_id <> v_replay.cancel_capability_id then
    raise exception 'line_pay_initialization_idempotent_result_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = v_first.product_order_id
      and product_order.user_id = '41000000-0000-4000-8000-000000000001'
      and product_order.order_no = 'PO-SANDBOX-ATOMIC-1'
      and product_order.total_amount_twd = 100
      and product_order.payment_method = 'line_pay'
      and product_order.payment_status = 'pending'
      and product_order.order_status = 'pending_payment'
      and product_order.shipping_status = 'not_applicable'
      and product_order.environment = 'sandbox'
      and product_order.fulfillment_mode = 'none'
      and product_order.sandbox_test
      and product_order.currency = 'TWD'
      and product_order.payment_id = v_first.payment_id
      and product_order.checkout_attempt_id = v_first.attempt_id
      and product_order.payment_request_state = 'initialized'
      and not product_order.reconciliation_required
  ) then
    raise exception 'line_pay_initialization_product_order_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
  ) <> 2
  or (
    select pg_catalog.sum(item.subtotal_twd)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
  ) <> 100 then
    raise exception 'line_pay_initialization_item_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_shipping_info as shipping
    where shipping.order_id = v_first.product_order_id
      and shipping.shipping_method = 'manual'
      and shipping.recipient_name is null
      and shipping.address is null
  ) then
    raise exception 'line_pay_initialization_shipping_contract_failed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    where payment.id = v_first.payment_id
      and payment.user_id = '41000000-0000-4000-8000-000000000001'
      and payment.provider = 'line_pay'
      and payment.item_type = 'spiritual_product_order'
      and payment.item_id = v_first.product_order_id::text
      and payment.amount_twd = 100
      and payment.currency = 'TWD'
      and payment.status = 'pending'
      and payment.merchant_order_no = 'LP_SANDBOX_ATOMIC_1'
      and payment.product_order_id = v_first.product_order_id
      and payment.environment = 'sandbox'
      and payment.checkout_attempt_id = v_first.attempt_id
      and payment.request_state = 'initialized'
      and payment.request_idempotency_key = 'sandbox-atomic-idempotency-0001'
      and payment.request_body_sha256 = pg_catalog.repeat('a', 64)
      and payment.raw_payload = pg_catalog.jsonb_build_object(
        'linePay',
        pg_catalog.jsonb_build_object(
          'orderId', 'LP_SANDBOX_ATOMIC_1',
          'sourceType', 'product_order',
          'sourceId', v_first.product_order_id::text
        )
      )
  ) then
    raise exception 'line_pay_initialization_payment_contract_failed';
  end if;

  if not exists (
    select 1
    from public.line_pay_checkout_attempts as attempt
    where attempt.id = v_first.attempt_id
      and attempt.payment_id = v_first.payment_id
      and attempt.product_order_id = v_first.product_order_id
      and attempt.request_state = 'queued'
      and attempt.amount_twd = 100
      and attempt.merchant_order_no = 'LP_SANDBOX_ATOMIC_1'
  ) then
    raise exception 'line_pay_initialization_attempt_contract_failed';
  end if;

  if not exists (
    select 1
    from public.line_pay_request_outbox as request_outbox
    where request_outbox.id = v_first.outbox_id
      and request_outbox.checkout_attempt_id = v_first.attempt_id
      and request_outbox.payment_id = v_first.payment_id
      and request_outbox.operation = 'request'
      and request_outbox.state = 'queued'
  ) then
    raise exception 'line_pay_initialization_outbox_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.line_pay_callback_capabilities as capability
    where capability.payment_id = v_first.payment_id
      and capability.product_order_id = v_first.product_order_id
      and capability.checkout_attempt_id = v_first.attempt_id
      and capability.environment = 'sandbox'
      and capability.capability_version = 1
      and capability.purpose in ('confirm', 'cancel')
  ) <> 2 then
    raise exception 'line_pay_initialization_capability_contract_failed';
  end if;
end;
$$;

reset role;

do $$
begin
  if (
    select pg_catalog.count(*)
    from public.line_pay_payment_audit_events as audit
    where audit.checkout_attempt_id = (
      select attempt_id
      from line_pay_initialization_first_result
    )
      and audit.payment_id = (
        select payment_id
        from line_pay_initialization_first_result
      )
      and audit.product_order_id = (
        select product_order_id
        from line_pay_initialization_first_result
      )
      and audit.environment = 'sandbox'
      and audit.event_type = 'checkout_initialized'
      and audit.from_state is null
      and audit.to_state = 'initialized'
      and audit.error_code is null
      and audit.request_id is null
      and audit.evidence = '{"reason_code":"checkout_initialized"}'::jsonb
  ) <> 1 then
    raise exception 'line_pay_initialization_audit_contract_failed';
  end if;
end;
$$;

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000099')
on conflict (id) do nothing;

begin;

update public.line_pay_checkout_attempts
set user_id = '41000000-0000-4000-8000-000000000099'
where id = (
  select attempt_id
  from line_pay_initialization_first_result
);

set local role service_role;

do $$
begin
  perform line_pay_private.record_line_pay_checkout_initialized_audit(
    (select payment_id from line_pay_initialization_first_result),
    (select product_order_id from line_pay_initialization_first_result),
    (select attempt_id from line_pay_initialization_first_result),
    'sandbox'
  );
  raise exception 'line_pay_initialization_cross_user_audit_was_accepted';
exception
  when check_violation then
    if sqlerrm <> 'line_pay_initialization_audit_binding_invalid' then
      raise;
    end if;
end;
$$;

rollback;

begin;

delete from public.line_pay_request_outbox
where id = (
  select outbox_id
  from line_pay_initialization_first_result
);

insert into public.line_pay_request_outbox (
  checkout_attempt_id,
  payment_id,
  environment,
  idempotency_key,
  request_body_sha256,
  state
)
select
  attempt_id,
  payment_id,
  'sandbox',
  'sandbox-wrong-audit-outbox-0001',
  pg_catalog.repeat('f', 64),
  'queued'
from line_pay_initialization_first_result;

set local role service_role;

do $$
begin
  perform line_pay_private.record_line_pay_checkout_initialized_audit(
    (select payment_id from line_pay_initialization_first_result),
    (select product_order_id from line_pay_initialization_first_result),
    (select attempt_id from line_pay_initialization_first_result),
    'sandbox'
  );
  raise exception 'line_pay_initialization_wrong_outbox_audit_was_accepted';
exception
  when check_violation then
    if sqlerrm <> 'line_pay_initialization_audit_binding_invalid' then
      raise;
    end if;
end;
$$;

rollback;

begin;

delete from public.line_pay_callback_capabilities
where id = (
  select confirm_capability_id
  from line_pay_initialization_first_result
);

set local role service_role;

do $$
begin
  perform line_pay_private.record_line_pay_checkout_initialized_audit(
    (select payment_id from line_pay_initialization_first_result),
    (select product_order_id from line_pay_initialization_first_result),
    (select attempt_id from line_pay_initialization_first_result),
    'sandbox'
  );
  raise exception 'line_pay_initialization_missing_confirm_audit_was_accepted';
exception
  when check_violation then
    if sqlerrm <> 'line_pay_initialization_audit_binding_invalid' then
      raise;
    end if;
end;
$$;

rollback;

begin;

update public.line_pay_callback_capabilities
set consumed_at = pg_catalog.clock_timestamp()
where id = (
  select cancel_capability_id
  from line_pay_initialization_first_result
);

set local role service_role;

do $$
begin
  perform line_pay_private.record_line_pay_checkout_initialized_audit(
    (select payment_id from line_pay_initialization_first_result),
    (select product_order_id from line_pay_initialization_first_result),
    (select attempt_id from line_pay_initialization_first_result),
    'sandbox'
  );
  raise exception 'line_pay_initialization_consumed_cancel_audit_was_accepted';
exception
  when check_violation then
    if sqlerrm <> 'line_pay_initialization_audit_binding_invalid' then
      raise;
    end if;
end;
$$;

rollback;

set role service_role;

do $$
declare
  v_invalid_snapshot_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload || pg_catalog.jsonb_build_object(
      'order_no', 'PO-SANDBOX-SNAPSHOT-ALLOWLIST-1',
      'merchant_order_no', 'LP_SANDBOX_SNAPSHOT_ALLOWLIST_1',
      'idempotency_key', 'sandbox-snapshot-allowlist-0001',
      'request_body_sha256', pg_catalog.repeat('4', 64),
      'confirm_token_hash', pg_catalog.repeat('8', 64),
      'cancel_token_hash', pg_catalog.repeat('5', 64)
    ),
    '{items,0,product_snapshot,unexpected_key}',
    '"must-not-cross-database-contract"'::jsonb,
    true
  )
  into strict v_invalid_snapshot_payload
  from line_pay_initialization_payload;

  perform *
  from public.initialize_product_order_line_pay_checkout(
    v_invalid_snapshot_payload
  );
  raise exception 'line_pay_initialization_snapshot_allowlist_was_bypassed';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_mismatched_snapshot_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload || pg_catalog.jsonb_build_object(
      'order_no', 'PO-SANDBOX-SNAPSHOT-BINDING-1',
      'merchant_order_no', 'LP_SANDBOX_SNAPSHOT_BINDING_1',
      'idempotency_key', 'sandbox-snapshot-binding-0001',
      'request_body_sha256', pg_catalog.repeat('6', 64),
      'confirm_token_hash', pg_catalog.repeat('9', 64),
      'cancel_token_hash', pg_catalog.repeat('7', 64)
    ),
    '{items,0,product_snapshot,priceTwd}',
    '1'::jsonb,
    false
  )
  into strict v_mismatched_snapshot_payload
  from line_pay_initialization_payload;

  perform *
  from public.initialize_product_order_line_pay_checkout(
    v_mismatched_snapshot_payload
  );
  raise exception 'line_pay_initialization_snapshot_binding_was_bypassed';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

begin;

update public.line_pay_checkout_attempts
set
  request_state = 'claimed',
  claim_id = '62000000-0000-4000-8000-000000000001',
  claimed_at = pg_catalog.clock_timestamp(),
  claim_expires_at = pg_catalog.clock_timestamp() + interval '5 minutes'
where id = (
  select attempt_id
  from line_pay_initialization_first_result
);

do $$
declare
  v_replay record;
begin
  select *
  into strict v_replay
  from public.initialize_product_order_line_pay_checkout(
    (select payload from line_pay_initialization_payload)
  );

  if v_replay.result_code <> 'already_initialized'
     or v_replay.request_state <> 'claimed' then
    raise exception 'line_pay_initialization_advanced_replay_contract_failed';
  end if;
end;
$$;

rollback;

begin;

update line_pay_initialization_payload
set payload = pg_catalog.jsonb_set(
  payload,
  '{capability_expires_at}',
  pg_catalog.to_jsonb(
    pg_catalog.to_char(
      pg_catalog.clock_timestamp() + interval '4 minutes',
      'YYYY-MM-DD"T"HH24:MI:SS.USOF'
    )
  ),
  false
);

update public.line_pay_callback_capabilities
set expires_at = (
  select (payload ->> 'capability_expires_at')::timestamptz
  from line_pay_initialization_payload
)
where checkout_attempt_id = (
  select attempt_id
  from line_pay_initialization_first_result
);

do $$
declare
  v_replay record;
begin
  select *
  into strict v_replay
  from public.initialize_product_order_line_pay_checkout(
    (select payload from line_pay_initialization_payload)
  );

  if v_replay.result_code <> 'already_initialized' then
    raise exception 'line_pay_initialization_near_expiry_replay_contract_failed';
  end if;
end;
$$;

rollback;

begin;

do $$
declare
  v_second record;
begin
  select *
  into strict v_second
  from public.initialize_product_order_line_pay_checkout(
    (
      select payload || pg_catalog.jsonb_build_object(
        'order_no', 'PO-SANDBOX-BINDING-2',
        'merchant_order_no', 'LP_SANDBOX_BINDING_2',
        'idempotency_key', 'sandbox-aggregate-binding-0002',
        'request_body_sha256', pg_catalog.repeat('d', 64),
        'confirm_token_hash', pg_catalog.repeat('e', 64),
        'cancel_token_hash', pg_catalog.repeat('f', 64)
      )
      from line_pay_initialization_payload
    )
  );

  update public.line_pay_request_outbox
  set payment_id = v_second.payment_id
  where id = (
    select outbox_id
    from line_pay_initialization_first_result
  );

  begin
    perform *
    from public.initialize_product_order_line_pay_checkout(
      (select payload from line_pay_initialization_payload)
    );
    raise exception
      'line_pay_initialization_aggregate_binding_drift_was_accepted';
  exception
    when unique_violation then
      if sqlerrm <> 'line_pay_initialization_idempotency_conflict' then
        raise;
      end if;
  end;
end;
$$;

rollback;

begin;

update public.payments
set item_id = null
where id = (
  select payment_id
  from line_pay_initialization_first_result
);

do $$
begin
  begin
    perform *
    from public.initialize_product_order_line_pay_checkout(
      (select payload from line_pay_initialization_payload)
    );
    raise exception
      'line_pay_initialization_null_reciprocal_item_id_was_accepted';
  exception
    when unique_violation then
      if sqlerrm <> 'line_pay_initialization_idempotency_conflict' then
        raise;
      end if;
  end;
end;
$$;

rollback;

do $$
begin
  perform *
  from public.initialize_product_order_line_pay_checkout(
    (select payload - 'shipping_info' from line_pay_initialization_payload)
  );
  raise exception 'line_pay_initialization_invalid_shape_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform *
  from public.initialize_product_order_line_pay_checkout(
    (
      select pg_catalog.jsonb_set(
        payload,
        '{shipping_info}',
        (payload -> 'shipping_info') - 'recipient_email',
        false
      )
      from line_pay_initialization_payload
    )
  );
  raise exception 'line_pay_initialization_missing_optional_shipping_key_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_path text[];
  v_value jsonb;
  v_invalid_payload jsonb;
begin
  for v_path, v_value in
    select fixture.path, fixture.value
    from (
      values
        (array['customer_email']::text[], '"not-an-email"'::jsonb),
        (array['customer_phone']::text[], '"call-me-maybe"'::jsonb),
        (
          array['shipping_info', 'recipient_email']::text[],
          '"missing-domain@example"'::jsonb
        ),
        (
          array['shipping_info', 'recipient_phone']::text[],
          '"private-phone-value"'::jsonb
        ),
        (
          array['shipping_info', 'postal_code']::text[],
          '"100<script>"'::jsonb
        ),
        (
          array['shipping_info', 'store_phone']::text[],
          '"store-phone-value"'::jsonb
        )
    ) as fixture(path, value)
  loop
    select pg_catalog.jsonb_set(payload, v_path, v_value, false)
    into strict v_invalid_payload
    from line_pay_initialization_payload;

    begin
      perform *
      from public.initialize_product_order_line_pay_checkout(v_invalid_payload);
      raise exception 'line_pay_initialization_invalid_contact_format_was_accepted';
    exception
      when sqlstate '22023' then
        if sqlerrm <> 'line_pay_initialization_invalid_input' then
          raise;
        end if;
    end;
  end loop;
end;
$$;

do $$
declare
  v_production_payload jsonb;
begin
  select payload || pg_catalog.jsonb_build_object(
    'environment', 'production',
    'order_no', 'PO-PRODUCTION-SHIPPING-1',
    'merchant_order_no', 'LP_PRODUCTION_SHIPPING_1',
    'idempotency_key', 'production-shipping-guard-0001',
    'request_body_sha256', pg_catalog.repeat('1', 64),
    'confirm_token_hash', pg_catalog.repeat('2', 64),
    'cancel_token_hash', pg_catalog.repeat('3', 64)
  )
  into strict v_production_payload
  from line_pay_initialization_payload;

  perform *
  from public.initialize_product_order_line_pay_checkout(v_production_payload);
  raise exception 'line_pay_initialization_incomplete_production_shipping_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

begin;

do $$
declare
  v_production_result record;
begin
  select *
  into strict v_production_result
  from public.initialize_product_order_line_pay_checkout(
    (
      select payload || pg_catalog.jsonb_build_object(
        'environment', 'production',
        'order_no', 'PO-PRODUCTION-SHIPPING-2',
        'merchant_order_no', 'LP_PRODUCTION_SHIPPING_2',
        'shipping_info', pg_catalog.jsonb_build_object(
          'recipient_name', 'Production Recipient',
          'recipient_phone', '0900000000',
          'recipient_email', null,
          'shipping_method', 'manual',
          'postal_code', null,
          'address', 'Synthetic production address',
          'store_type', null,
          'store_id', null,
          'store_name', null,
          'store_address', null,
          'store_phone', null
        ),
        'idempotency_key', 'production-shipping-guard-0002',
        'request_body_sha256', pg_catalog.repeat('4', 64),
        'confirm_token_hash', pg_catalog.repeat('5', 64),
        'cancel_token_hash', pg_catalog.repeat('6', 64)
      )
      from line_pay_initialization_payload
    )
  );

  if v_production_result.result_code <> 'initialized'
     or not exists (
       select 1
       from public.product_orders as product_order
       where product_order.id = v_production_result.product_order_id
         and product_order.environment = 'production'
         and product_order.fulfillment_mode = 'physical'
         and product_order.shipping_status = 'not_shipped'
     ) then
    raise exception 'line_pay_initialization_complete_production_shipping_failed';
  end if;
end;
$$;

rollback;

begin;

do $$
declare
  v_method text;
  v_required_field text;
  v_required_fields text[];
  v_shipping jsonb;
  v_payload jsonb;
  v_result record;
  v_case integer := 0;
begin
  foreach v_method in array array[
    'manual',
    'home_delivery',
    'convenience_store_c2c',
    'convenience_store_b2c'
  ]::text[] loop
    v_shipping := pg_catalog.jsonb_build_object(
      'recipient_name', 'Production Recipient',
      'recipient_phone', '0900000000',
      'recipient_email', null,
      'shipping_method', v_method,
      'postal_code', '100',
      'address', 'Synthetic production address',
      'store_type', 'synthetic_store',
      'store_id', 'SYNTHETIC-STORE-001',
      'store_name', 'Synthetic Store',
      'store_address', 'Synthetic store address',
      'store_phone', null
    );
    v_required_fields := case
      when v_method in ('manual', 'home_delivery')
        then array['recipient_name', 'recipient_phone', 'address']::text[]
      else array[
        'recipient_name',
        'recipient_phone',
        'store_type',
        'store_id',
        'store_name',
        'store_address'
      ]::text[]
    end;

    foreach v_required_field in array v_required_fields loop
      v_case := v_case + 1;
      select payload || pg_catalog.jsonb_build_object(
        'environment', 'production',
        'order_no', 'PO-PROD-SHIP-OMIT-' || v_case::text,
        'merchant_order_no', 'LP_PROD_SHIP_OMIT_' || v_case::text,
        'shipping_info', v_shipping - v_required_field,
        'idempotency_key', 'production-shipping-omission-' || v_case::text,
        'request_body_sha256',
          pg_catalog.md5('request-' || v_case::text)
          || pg_catalog.md5('body-' || v_case::text),
        'confirm_token_hash',
          pg_catalog.md5('confirm-' || v_case::text)
          || pg_catalog.md5('token-' || v_case::text),
        'cancel_token_hash',
          pg_catalog.md5('cancel-' || v_case::text)
          || pg_catalog.md5('token-' || v_case::text)
      )
      into strict v_payload
      from line_pay_initialization_payload;

      begin
        perform *
        from public.initialize_product_order_line_pay_checkout(v_payload);
        raise exception
          'line_pay_initialization_required_shipping_field_was_accepted';
      exception
        when sqlstate '22023' then
          if sqlerrm <> 'line_pay_initialization_invalid_input' then
            raise;
          end if;
      end;
    end loop;

    v_case := v_case + 1;
    select payload || pg_catalog.jsonb_build_object(
      'environment', 'production',
      'order_no', 'PO-PROD-SHIP-VALID-' || v_case::text,
      'merchant_order_no', 'LP_PROD_SHIP_VALID_' || v_case::text,
      'shipping_info', v_shipping,
      'idempotency_key', 'production-shipping-valid-' || v_case::text,
      'request_body_sha256',
        pg_catalog.md5('request-' || v_case::text)
        || pg_catalog.md5('body-' || v_case::text),
      'confirm_token_hash',
        pg_catalog.md5('confirm-' || v_case::text)
        || pg_catalog.md5('token-' || v_case::text),
      'cancel_token_hash',
        pg_catalog.md5('cancel-' || v_case::text)
        || pg_catalog.md5('token-' || v_case::text)
    )
    into strict v_payload
    from line_pay_initialization_payload;

    select *
    into strict v_result
    from public.initialize_product_order_line_pay_checkout(v_payload);

    if v_result.result_code <> 'initialized' then
      raise exception 'line_pay_initialization_valid_shipping_method_failed';
    end if;
  end loop;
end;
$$;

rollback;

do $$
declare
  v_oversized_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload,
    '{items}',
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'product_slug',
            'oversized-'
            || pg_catalog.lpad(item_index::text, 3, '0')
            || pg_catalog.repeat('s', 180),
          'product_name', pg_catalog.repeat('N', 500),
          'unit_price_twd', 1,
          'quantity', 1,
          'product_snapshot', pg_catalog.jsonb_build_object(
            'slug',
              'oversized-'
              || pg_catalog.lpad(item_index::text, 3, '0')
              || pg_catalog.repeat('s', 180),
            'name', pg_catalog.repeat('N', 500),
            'category', '符咒商品',
            'priceTwd', 1
          )
        )
      )
      from pg_catalog.generate_series(1, 100) as item_index
    )
  )
  into strict v_oversized_payload
  from line_pay_initialization_payload;

  if pg_catalog.octet_length(v_oversized_payload::text) <= 65536 then
    raise exception 'line_pay_initialization_oversized_fixture_too_small';
  end if;

  perform *
  from public.initialize_product_order_line_pay_checkout(v_oversized_payload);
  raise exception 'line_pay_initialization_oversized_payload_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_mismatched_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload,
    '{customer_name}',
    '"Different customer with same claimed body hash"'::jsonb
  )
  into strict v_mismatched_payload
  from line_pay_initialization_payload;

  perform *
  from public.initialize_product_order_line_pay_checkout(v_mismatched_payload);
  raise exception 'line_pay_initialization_mismatched_replay_was_accepted';
exception
  when unique_violation then
    if sqlerrm <> 'line_pay_initialization_idempotency_conflict' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_conflict_payload jsonb;
begin
  select payload || pg_catalog.jsonb_build_object(
    'order_no', 'PO-SANDBOX-ROLLBACK-1',
    'merchant_order_no', 'LP_SANDBOX_ROLLBACK_1',
    'idempotency_key', 'sandbox-atomic-idempotency-0002',
    'request_body_sha256', pg_catalog.repeat('d', 64),
    'cancel_token_hash', pg_catalog.repeat('e', 64)
  )
  into strict v_conflict_payload
  from line_pay_initialization_payload;

  begin
    perform *
    from public.initialize_product_order_line_pay_checkout(v_conflict_payload);
    raise exception 'line_pay_initialization_late_conflict_was_accepted';
  exception
    when unique_violation then
      null;
  end;

  if exists (
    select 1
    from public.product_orders
    where order_no = 'PO-SANDBOX-ROLLBACK-1'
  )
  or exists (
    select 1
    from public.payments
    where merchant_order_no = 'LP_SANDBOX_ROLLBACK_1'
  )
  or exists (
    select 1
    from public.line_pay_checkout_attempts
    where idempotency_key = 'sandbox-atomic-idempotency-0002'
  )
  or exists (
    select 1
    from public.line_pay_request_outbox
    where idempotency_key = 'sandbox-atomic-idempotency-0002'
  ) then
    raise exception 'line_pay_initialization_late_conflict_did_not_roll_back';
  end if;
end;
$$;

reset role;
