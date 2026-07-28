\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

with
inventory as (
  select
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where (
        namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
      )
      or (
        namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
      )
    ) as functions_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_class as index_relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = index_relation.relnamespace
      where namespace.nspname = 'public'
        and index_relation.relkind = 'i'
        and index_relation.relname =
          'line_pay_payment_audit_events_checkout_initialized_once_idx'
    ) as indexes_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and policy.polname in (
          'line_pay_payment_function_owner_checkout_initialized_audit_insert',
          'line_pay_payment_function_owner_initialization_items_select',
          'line_pay_payment_function_owner_initialization_shipping_select'
        )
    ) as policies_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
      where namespace.nspname = 'public'
        and relation.relname in (
          'product_order_items',
          'product_shipping_info'
        )
        and grantee.rolname = 'line_pay_payment_function_owner'
        and acl.privilege_type = 'SELECT'
        and not acl.is_grantable
        and acl.grantor = relation.relowner
    ) as table_select_grants_present
),
base_contract as (
  select
    (
      select pg_catalog.count(*) = 9
      from (
        values
          ('public', 'product_orders'),
          ('public', 'product_order_items'),
          ('public', 'product_shipping_info'),
          ('public', 'payments'),
          ('public', 'line_pay_checkout_attempts'),
          ('public', 'line_pay_request_outbox'),
          ('public', 'line_pay_callback_capabilities'),
          ('public', 'line_pay_callback_events'),
          ('public', 'line_pay_payment_audit_events')
      ) as expected(schema_name, relation_name)
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
       and relation.relkind in ('r', 'p')
    )
    and pg_catalog.to_regprocedure(
      'public.claim_product_order_line_pay_request(uuid,text,text,text,uuid,timestamp with time zone)'
    ) is not null
    and pg_catalog.to_regrole('line_pay_payment_function_owner') is not null
    and pg_catalog.to_regrole('service_role') is not null
    as ready
),
initializer_contract as (
  select
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
        and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb'
        and not procedure.prosecdef
        and procedure.provolatile = 'v'
        and 'search_path=""' = any (procedure.proconfig)
        and pg_catalog.obj_description(procedure.oid, 'pg_proc')
          = 'line_pay_definition_md5:01f23508c326066dd4c7ef214c27b60e'
        and pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
          = '01f23508c326066dd4c7ef214c27b60e'
        and pg_catalog.has_function_privilege(
          'service_role',
          procedure.oid,
          'execute'
        )
        and not pg_catalog.has_function_privilege(
          'anon',
          procedure.oid,
          'execute'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'execute'
        )
    )
    and (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
        and procedure.prosecdef
        and procedure.provolatile = 'v'
        and owner.rolname = 'line_pay_payment_function_owner'
        and 'search_path=""' = any (procedure.proconfig)
        and pg_catalog.obj_description(procedure.oid, 'pg_proc')
          = 'line_pay_definition_md5:58527777d0bd2138231218673699b634'
        and pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
          = '58527777d0bd2138231218673699b634'
    )
    and (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_index as index_catalog
      join pg_catalog.pg_class as index_relation
        on index_relation.oid = index_catalog.indexrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = index_relation.relnamespace
      where namespace.nspname = 'public'
        and index_relation.relname =
          'line_pay_payment_audit_events_checkout_initialized_once_idx'
        and index_catalog.indisunique
        and index_catalog.indisvalid
        and index_catalog.indisready
        and pg_catalog.pg_get_expr(
          index_catalog.indpred,
          index_catalog.indrelid
        ) = '(event_type = ''checkout_initialized''::text)'
    )
    and (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'line_pay_payment_audit_events'
        and policy.polname =
          'line_pay_payment_function_owner_checkout_initialized_audit_insert'
        and policy.polcmd = 'a'
        and policy.polpermissive
        and policy.polroles = array[
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        ]::oid[]
        and policy.polqual is null
        and pg_catalog.pg_get_expr(
          policy.polwithcheck,
          policy.polrelid
        ) = '(event_type = ''checkout_initialized''::text)'
    )
    and (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'product_order_items'
        and policy.polname =
          'line_pay_payment_function_owner_initialization_items_select'
        and policy.polcmd = 'r'
        and policy.polpermissive
        and policy.polroles = array[
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        ]::oid[]
        and policy.polwithcheck is null
        and pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) =
          '(EXISTS ( SELECT 1
   FROM product_orders product_order
  WHERE ((product_order.id = product_order_items.order_id) AND (product_order.payment_method = ''line_pay''::text))))'
    )
    and (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'product_shipping_info'
        and policy.polname =
          'line_pay_payment_function_owner_initialization_shipping_select'
        and policy.polcmd = 'r'
        and policy.polpermissive
        and policy.polroles = array[
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        ]::oid[]
        and policy.polwithcheck is null
        and pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) =
          '(EXISTS ( SELECT 1
   FROM product_orders product_order
  WHERE ((product_order.id = product_shipping_info.order_id) AND (product_order.payment_method = ''line_pay''::text))))'
    )
    and pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_order_items',
      'select'
    )
    and pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_shipping_info',
      'select'
    )
    and not pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_order_items',
      'insert,update,delete,truncate,references,trigger'
    )
    and not pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_shipping_info',
      'insert,update,delete,truncate,references,trigger'
    )
    as exact
),
audit_count as (
  select pg_catalog.count(*)::integer as value
  from public.line_pay_payment_audit_events
  where event_type = 'checkout_initialized'
),
state as (
  select
    case
      when inventory.functions_present = 0
        and inventory.indexes_present = 0
        and inventory.policies_present = 0
        and inventory.table_select_grants_present = 0
        then 'UNAPPLIED'
      when initializer_contract.exact
        and inventory.functions_present = 2
        and inventory.indexes_present = 1
        and inventory.policies_present = 3
        and inventory.table_select_grants_present = 2
        then 'FULL'
      else 'PARTIAL'
    end as value
  from inventory, initializer_contract
)
select pg_catalog.jsonb_build_object(
  'status', 'LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE',
  'database_identity_match',
    pg_catalog.current_database() = 'postgres'
    and not pg_catalog.pg_is_in_recovery(),
  'inventory', pg_catalog.jsonb_build_object(
    'functions_present', inventory.functions_present,
    'indexes_present', inventory.indexes_present,
    'policies_present', inventory.policies_present,
    'table_select_grants_present',
      inventory.table_select_grants_present
  ),
  'contracts', pg_catalog.jsonb_build_object(
    'base_remediation_ready', base_contract.ready,
    'initializer_exact', initializer_contract.exact
  ),
  'checkout_initialized_audit_count', audit_count.value,
  'application_state', state.value
)::text
from inventory, base_contract, initializer_contract, audit_count, state;
