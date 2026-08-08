\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $postflight$
declare
  v_wrapper pg_catalog.pg_proc%rowtype;
  v_private_marker pg_catalog.pg_proc%rowtype;
  v_order_guard pg_catalog.pg_proc%rowtype;
  v_child_guard pg_catalog.pg_proc%rowtype;
  v_marker_table pg_catalog.pg_class%rowtype;
  v_wrapper_definition text;
  v_marker_definition text;
  v_order_guard_definition text;
  v_child_guard_definition text;
begin
  select procedure.* into v_wrapper
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb,text)'
  );
  select procedure.* into v_private_marker
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid,uuid,text)'
  );
  select procedure.* into v_order_guard
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.enforce_line_pay_production_one_dollar_order_guard()'
  );
  select procedure.* into v_child_guard
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.enforce_line_pay_production_one_dollar_child_guard()'
  );
  select relation.* into v_marker_table
  from pg_catalog.pg_class as relation
  where relation.oid = pg_catalog.to_regclass(
    'line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders'
  );

  if v_wrapper.oid is not null then
    v_wrapper_definition := pg_catalog.pg_get_functiondef(v_wrapper.oid);
  end if;
  if v_private_marker.oid is not null then
    v_marker_definition := pg_catalog.pg_get_functiondef(v_private_marker.oid);
  end if;
  if v_order_guard.oid is not null then
    v_order_guard_definition := pg_catalog.pg_get_functiondef(v_order_guard.oid);
  end if;
  if v_child_guard.oid is not null then
    v_child_guard_definition := pg_catalog.pg_get_functiondef(v_child_guard.oid);
  end if;

  if v_wrapper.oid is null
    or v_wrapper.prosecdef
    or v_wrapper.provolatile <> 'v'
    or v_wrapper.prokind <> 'f'
    or v_wrapper.proconfig is distinct from array['search_path=""']::text[]
    or pg_catalog.md5(v_wrapper.prosrc) <>
      '939e95e900bf624bcae9165cbc523832'
    or pg_catalog.strpos(
      v_wrapper_definition,
      'initialize_product_order_line_pay_checkout'
    ) = 0
    or pg_catalog.strpos(
      v_wrapper_definition,
      'mark_line_pay_production_one_dollar_non_fulfillment'
    ) = 0
    or v_private_marker.oid is null
    or not v_private_marker.prosecdef
    or v_private_marker.provolatile <> 'v'
    or v_private_marker.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or v_private_marker.proconfig is distinct from array['search_path=""']::text[]
    or pg_catalog.md5(v_private_marker.prosrc) <>
      '766613c9417a661ef9434c55d2531f72'
    or pg_catalog.strpos(v_marker_definition, 'pg_catalog.count(*)') = 0
    or pg_catalog.strpos(v_marker_definition, '符咒商品') = 0
    or pg_catalog.strpos(v_marker_definition, '不出貨、不提供服務') = 0
    or pg_catalog.strpos(v_marker_definition, 'LPONE-') = 0
    or pg_catalog.strpos(v_marker_definition, 'LP_ONE_') = 0
    or pg_catalog.strpos(
      v_marker_definition,
      'line_pay_production_nt1_non_fulfillment:'
    ) = 0
    or v_order_guard.oid is null
    or not v_order_guard.prosecdef
    or v_order_guard.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or pg_catalog.md5(v_order_guard.prosrc) <>
      '114b9f6b28ed0fffd59c589fc6039c05'
    or pg_catalog.strpos(
      v_order_guard_definition,
      'line_pay_production_nt1_non_fulfillment:'
    ) = 0
    or pg_catalog.strpos(
      v_order_guard_definition,
      'line_pay_production_one_dollar_fulfillment_is_forbidden'
    ) = 0
    or pg_catalog.strpos(
      v_order_guard_definition,
      'line_pay_production_one_dollar_non_fulfillment_orders'
    ) = 0
    or v_child_guard.oid is null
    or not v_child_guard.prosecdef
    or v_child_guard.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or pg_catalog.md5(v_child_guard.prosrc) <>
      'da07c70b859a0a76a77e00e04bd5f156'
    or pg_catalog.strpos(
      v_child_guard_definition,
      'line_pay_production_nt1_non_fulfillment:'
    ) = 0
    or pg_catalog.strpos(
      v_child_guard_definition,
      'line_pay_production_one_dollar_aggregate_is_immutable'
    ) = 0
    or pg_catalog.strpos(
      v_child_guard_definition,
      'line_pay_production_one_dollar_non_fulfillment_orders'
    ) = 0
    or v_marker_table.oid is null
    or not v_marker_table.relrowsecurity
    or v_marker_table.relforcerowsecurity
    or v_marker_table.relowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or not pg_catalog.has_function_privilege(
      'service_role', v_wrapper.oid, 'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role', v_private_marker.oid, 'EXECUTE'
    )
    or pg_catalog.has_function_privilege('anon', v_wrapper.oid, 'EXECUTE')
    or pg_catalog.has_function_privilege(
      'authenticated', v_wrapper.oid, 'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor', v_wrapper.oid, 'EXECUTE'
    )
    or pg_catalog.has_table_privilege(
      'service_role', v_marker_table.oid, 'INSERT,UPDATE,DELETE'
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          v_wrapper.proacl,
          pg_catalog.acldefault('f', v_wrapper.proowner)
        )
      ) as function_grant
      where function_grant.privilege_type = 'EXECUTE'
        and function_grant.grantee not in (
          v_wrapper.proowner,
          pg_catalog.to_regrole('service_role')::oid
        )
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          v_private_marker.proacl,
          pg_catalog.acldefault('f', v_private_marker.proowner)
        )
      ) as function_grant
      where function_grant.privilege_type = 'EXECUTE'
        and function_grant.grantee not in (
          v_private_marker.proowner,
          pg_catalog.to_regrole('service_role')::oid
        )
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          v_order_guard.proacl,
          pg_catalog.acldefault('f', v_order_guard.proowner)
        )
      ) as function_grant
      where function_grant.privilege_type = 'EXECUTE'
        and function_grant.grantee <> v_order_guard.proowner
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          v_child_guard.proacl,
          pg_catalog.acldefault('f', v_child_guard.proowner)
        )
      ) as function_grant
      where function_grant.privilege_type = 'EXECUTE'
        and function_grant.grantee <> v_child_guard.proowner
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          v_marker_table.relacl,
          pg_catalog.acldefault('r', v_marker_table.relowner)
        )
      ) as table_grant
      where table_grant.grantee <> v_marker_table.relowner
    )
    or not pg_catalog.has_column_privilege(
      'line_pay_payment_function_owner',
      'public.product_orders',
      'fulfillment_mode',
      'UPDATE'
    )
    or not pg_catalog.has_column_privilege(
      'line_pay_payment_function_owner',
      'public.product_orders',
      'shipping_status',
      'UPDATE'
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname =
          'line_pay_00_production_one_dollar_order_guard'
        and trigger_record.tgrelid = 'public.product_orders'::regclass
        and trigger_record.tgfoid = v_order_guard.oid
        and trigger_record.tgtype = 19
        and trigger_record.tgenabled = 'O'
        and not trigger_record.tgisinternal
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname =
          'line_pay_production_one_dollar_item_guard'
        and trigger_record.tgrelid = 'public.product_order_items'::regclass
        and trigger_record.tgfoid = v_child_guard.oid
        and trigger_record.tgtype = 31
        and trigger_record.tgenabled = 'O'
        and not trigger_record.tgisinternal
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname =
          'line_pay_production_one_dollar_shipping_guard'
        and trigger_record.tgrelid =
          'public.product_shipping_info'::regclass
        and trigger_record.tgfoid = v_child_guard.oid
        and trigger_record.tgtype = 31
        and trigger_record.tgenabled = 'O'
        and not trigger_record.tgisinternal
    )
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_production_one_dollar_non_fulfillment_postflight_failed';
  end if;
end;
$postflight$;

select 'line_pay_production_one_dollar_non_fulfillment_postflight_ready';
