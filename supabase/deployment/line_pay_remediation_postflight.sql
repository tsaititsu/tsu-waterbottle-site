with
database_contract as (
  select
    pg_catalog.current_database() as name,
    pg_catalog.current_setting('server_version_num')::integer / 10000 as major,
    pg_catalog.pg_is_in_recovery() as recovery
),
expected_relations(schema_name, relation_name, owner_name) as (
  values
    ('public', 'app_environment_attestation', 'postgres'),
    ('public', 'line_pay_checkout_attempts', 'postgres'),
    ('public', 'line_pay_request_outbox', 'postgres'),
    ('public', 'line_pay_callback_capabilities', 'postgres'),
    ('public', 'line_pay_callback_events', 'postgres'),
    ('public', 'line_pay_payment_audit_events', 'postgres'),
    ('line_pay_private', 'line_pay_completion_proofs', 'line_pay_payment_function_owner')
),
expected_roles(role_name) as (
  values
    ('line_pay_payment_executor'),
    ('line_pay_payment_function_owner')
),
expected_functions(
  schema_name,
  function_name,
  argument_types,
  return_type,
  language_name,
  owner_name,
  security_definer,
  volatility
) as (
  values
    ('public', 'line_pay_sanitized_result_is_valid', 'jsonb', 'boolean', 'sql', 'postgres', false, 'i'),
    ('public', 'line_pay_audit_evidence_is_valid', 'jsonb', 'boolean', 'sql', 'postgres', false, 'i'),
    ('public', 'line_pay_touch_updated_at', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_attempt_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_payment_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_product_order_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_outbox_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_callback_capability_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'line_pay_enforce_callback_event_transition', '', 'trigger', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'claim_product_order_line_pay_request', 'uuid, text, text, text, uuid, timestamp with time zone', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'record_product_order_line_pay_request_success', 'uuid, text, text, text, uuid, text, text, jsonb, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'record_product_order_line_pay_request_failure', 'uuid, text, text, text, uuid, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'mark_product_order_line_pay_request_unknown', 'uuid, text, text, text, uuid, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'read_product_order_line_pay_request_result', 'uuid, text, text, text', 'record', 'sql', 'postgres', false, 's'),
    ('public', 'claim_line_pay_callback_capability', 'text, text, text, uuid, uuid, uuid, uuid, timestamp with time zone', 'record', 'plpgsql', 'postgres', false, 'v'),
    ('public', 'claim_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'record_product_order_line_pay_confirmation_evidence', 'text, uuid, uuid, text, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'complete_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamp with time zone', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'cancel_product_order_line_pay_payment', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('public', 'mark_product_order_line_pay_reconciliation', 'text, uuid, uuid, uuid, text, text', 'record', 'plpgsql', 'line_pay_payment_function_owner', true, 'v'),
    ('line_pay_private', 'line_pay_enforce_completion_proof', '', 'trigger', 'plpgsql', 'line_pay_payment_function_owner', false, 'v')
),
expected_function_access(
  schema_name,
  function_name,
  argument_types,
  parallel_safety,
  raw_acl,
  effective_acl
) as (
  values
    ('public', 'line_pay_sanitized_result_is_valid', 'jsonb', 's', '{postgres=X/postgres,service_role=X/postgres,line_pay_payment_function_owner=X/postgres}', '{postgres=X/postgres,service_role=X/postgres,line_pay_payment_function_owner=X/postgres}'),
    ('public', 'line_pay_audit_evidence_is_valid', 'jsonb', 's', '{postgres=X/postgres,service_role=X/postgres,line_pay_payment_function_owner=X/postgres}', '{postgres=X/postgres,service_role=X/postgres,line_pay_payment_function_owner=X/postgres}'),
    ('public', 'line_pay_touch_updated_at', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'line_pay_enforce_attempt_transition', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'line_pay_enforce_payment_transition', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'line_pay_enforce_product_order_transition', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'line_pay_enforce_outbox_transition', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'line_pay_enforce_callback_capability_transition', '', 'u', null::text, '{=X/postgres,postgres=X/postgres}'),
    ('public', 'line_pay_enforce_callback_event_transition', '', 'u', '{postgres=X/postgres}', '{postgres=X/postgres}'),
    ('public', 'claim_product_order_line_pay_request', 'uuid, text, text, text, uuid, timestamp with time zone', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'record_product_order_line_pay_request_success', 'uuid, text, text, text, uuid, text, text, jsonb, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'record_product_order_line_pay_request_failure', 'uuid, text, text, text, uuid, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'mark_product_order_line_pay_request_unknown', 'uuid, text, text, text, uuid, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'read_product_order_line_pay_request_result', 'uuid, text, text, text', 'u', '{postgres=X/postgres,service_role=X/postgres}', '{postgres=X/postgres,service_role=X/postgres}'),
    ('public', 'claim_line_pay_callback_capability', 'text, text, text, uuid, uuid, uuid, uuid, timestamp with time zone', 'u', '{postgres=X/postgres,service_role=X/postgres}', '{postgres=X/postgres,service_role=X/postgres}'),
    ('public', 'claim_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'record_product_order_line_pay_confirmation_evidence', 'text, uuid, uuid, text, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,line_pay_payment_executor=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,line_pay_payment_executor=X/line_pay_payment_function_owner}'),
    ('public', 'complete_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamp with time zone', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,line_pay_payment_executor=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,line_pay_payment_executor=X/line_pay_payment_function_owner}'),
    ('public', 'cancel_product_order_line_pay_payment', 'text, uuid, uuid, uuid, uuid, uuid, uuid, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('public', 'mark_product_order_line_pay_reconciliation', 'text, uuid, uuid, uuid, text, text', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner,service_role=X/line_pay_payment_function_owner}'),
    ('line_pay_private', 'line_pay_enforce_completion_proof', '', 'u', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner}', '{line_pay_payment_function_owner=X/line_pay_payment_function_owner}')
),
expected_indexes(index_name) as (
  values
    ('line_pay_checkout_attempts_environment_key_idx'),
    ('line_pay_checkout_attempts_environment_transaction_idx'),
    ('line_pay_checkout_attempts_environment_merchant_idx'),
    ('line_pay_checkout_attempts_payment_id_idx'),
    ('line_pay_checkout_attempts_owner_idx'),
    ('line_pay_checkout_attempts_order_idx'),
    ('line_pay_checkout_attempts_reconciliation_idx'),
    ('line_pay_request_outbox_attempt_operation_idx'),
    ('line_pay_request_outbox_environment_key_idx'),
    ('line_pay_request_outbox_claimable_idx'),
    ('line_pay_request_outbox_reconciliation_idx'),
    ('line_pay_callback_capabilities_token_hash_idx'),
    ('line_pay_callback_capabilities_binding_idx'),
    ('line_pay_callback_capabilities_active_idx'),
    ('line_pay_callback_events_binding_idx'),
    ('line_pay_callback_events_reconciliation_idx'),
    ('line_pay_payment_audit_events_payment_idx'),
    ('line_pay_payment_audit_events_order_idx'),
    ('line_pay_payment_audit_events_attempt_idx'),
    ('product_orders_owner_id_idx'),
    ('product_orders_checkout_attempt_id_idx'),
    ('payments_product_order_owner_idx'),
    ('payments_checkout_attempt_id_idx'),
    ('payments_line_pay_idempotency_idx'),
    ('payments_line_pay_transaction_idx')
),
expected_triggers(trigger_name) as (
  values
    ('line_pay_checkout_attempts_touch_updated_at'),
    ('line_pay_request_outbox_touch_updated_at'),
    ('line_pay_request_outbox_transition_guard'),
    ('line_pay_callback_capabilities_touch_updated_at'),
    ('line_pay_callback_capabilities_transition_guard'),
    ('line_pay_callback_events_touch_updated_at'),
    ('line_pay_callback_events_transition_guard'),
    ('line_pay_checkout_attempts_transition_guard'),
    ('line_pay_payments_transition_guard'),
    ('line_pay_product_orders_transition_guard'),
    ('line_pay_completion_proofs_guard')
),
expected_policies(policy_name) as (
  values
    ('line_pay_payment_function_owner_payments_select'),
    ('line_pay_payment_function_owner_payments_update'),
    ('line_pay_payment_function_owner_orders_select'),
    ('line_pay_payment_function_owner_orders_update'),
    ('line_pay_payment_function_owner_attempts_select'),
    ('line_pay_payment_function_owner_attempts_update'),
    ('line_pay_payment_function_owner_outbox_select'),
    ('line_pay_payment_function_owner_outbox_update'),
    ('line_pay_payment_function_owner_capabilities_select'),
    ('line_pay_payment_function_owner_capabilities_update'),
    ('line_pay_payment_function_owner_events_select'),
    ('line_pay_payment_function_owner_events_update'),
    ('line_pay_payment_function_owner_audit_select'),
    ('line_pay_payment_function_owner_audit_insert')
),
expected_added_columns(table_name, column_name, type_name, not_null) as (
  values
    ('product_orders', 'environment', 'text', true),
    ('product_orders', 'fulfillment_mode', 'text', true),
    ('product_orders', 'sandbox_test', 'boolean', true),
    ('product_orders', 'currency', 'text', true),
    ('product_orders', 'checkout_attempt_id', 'uuid', false),
    ('product_orders', 'payment_request_state', 'text', false),
    ('product_orders', 'reconciliation_required', 'boolean', true),
    ('product_orders', 'state_version', 'integer', true),
    ('payments', 'product_order_id', 'uuid', false),
    ('payments', 'environment', 'text', true),
    ('payments', 'checkout_attempt_id', 'uuid', false),
    ('payments', 'request_state', 'text', false),
    ('payments', 'request_idempotency_key', 'text', false),
    ('payments', 'request_body_sha256', 'text', false),
    ('payments', 'line_pay_transaction_id', 'text', false),
    ('payments', 'reconciliation_required', 'boolean', true),
    ('payments', 'state_version', 'integer', true)
),
expected_existing_constraints(table_name, constraint_name) as (
  values
    ('product_orders', 'product_orders_payment_method_check'),
    ('product_orders', 'product_orders_order_status_check'),
    ('product_orders', 'product_orders_shipping_status_check'),
    ('product_orders', 'product_orders_environment_check'),
    ('product_orders', 'product_orders_fulfillment_mode_check'),
    ('product_orders', 'product_orders_currency_check'),
    ('product_orders', 'product_orders_payment_request_state_check'),
    ('product_orders', 'product_orders_state_version_check'),
    ('product_orders', 'product_orders_line_pay_owner_check'),
    ('product_orders', 'product_orders_line_pay_environment_check'),
    ('product_orders', 'product_orders_sandbox_fulfillment_check'),
    ('product_orders', 'product_orders_line_pay_reconciliation_check'),
    ('product_orders', 'product_orders_checkout_attempt_id_fkey'),
    ('payments', 'payments_product_order_id_fkey'),
    ('payments', 'payments_environment_check'),
    ('payments', 'payments_request_state_check'),
    ('payments', 'payments_request_body_sha256_check'),
    ('payments', 'payments_request_idempotency_key_check'),
    ('payments', 'payments_line_pay_transaction_id_check'),
    ('payments', 'payments_state_version_check'),
    ('payments', 'payments_line_pay_contract_check'),
    ('payments', 'payments_line_pay_reconciliation_check'),
    ('payments', 'payments_checkout_attempt_id_fkey')
),
relation_contract as (
  select
    pg_catalog.count(*) = (select pg_catalog.count(*) from expected_relations)
    and pg_catalog.bool_and(
      relation.relkind = 'r'
      and relation.relrowsecurity
      and not relation.relforcerowsecurity
      and owner.rolname = expected.owner_name
    ) as exact
  from expected_relations as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
  left join pg_catalog.pg_roles as owner on owner.oid = relation.relowner
  where relation.oid is not null
),
role_contract as (
  select
    pg_catalog.count(*) = 2
    and pg_catalog.bool_and(
      not role.rolcanlogin
      and not role.rolinherit
      and not role.rolsuper
      and not role.rolcreatedb
      and not role.rolcreaterole
      and not role.rolreplication
      and not role.rolbypassrls
      and role.rolconnlimit = -1
      and role.rolconfig is null
      and role.rolvaliduntil is null
    )
    and not exists (
      select 1
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as granted_role
        on granted_role.oid = membership.roleid
      join pg_catalog.pg_roles as member_role
        on member_role.oid = membership.member
      where granted_role.rolname in (select role_name from expected_roles)
         or member_role.rolname in (select role_name from expected_roles)
    )
    and not exists (
      select 1
      from pg_catalog.pg_default_acl as default_acl
      join pg_catalog.pg_roles as role on role.oid = default_acl.defaclrole
      where role.rolname in (select role_name from expected_roles)
    ) as exact
  from expected_roles as expected
  join pg_catalog.pg_roles as role on role.rolname = expected.role_name
),
function_actual as (
  select
    namespace.nspname as schema_name,
    procedure.proname as function_name,
    pg_catalog.oidvectortypes(procedure.proargtypes) as argument_types,
    pg_catalog.format_type(procedure.prorettype, null) as return_type,
    language.lanname as language_name,
    owner.rolname as owner_name,
    procedure.prosecdef as security_definer,
    procedure.provolatile as volatility,
    procedure.proparallel,
    procedure.proleakproof,
    procedure.proconfig,
    procedure.proacl,
    procedure.prosrc,
    coalesce(
      procedure.proacl,
      pg_catalog.acldefault('f', procedure.proowner)
    )::text as effective_acl,
    procedure.oid
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_language as language
    on language.oid = procedure.prolang
  join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
  where (namespace.nspname, procedure.proname) in (
    select schema_name, function_name from expected_functions
  )
),
function_contract as (
  select
    (select pg_catalog.count(*) from function_actual)
      = (select pg_catalog.count(*) from expected_functions)
    and not exists (
      select 1
      from expected_functions as expected
      left join function_actual as actual
        on actual.schema_name = expected.schema_name
       and actual.function_name = expected.function_name
       and actual.argument_types = expected.argument_types
      left join expected_function_access as access
        on access.schema_name = expected.schema_name
       and access.function_name = expected.function_name
       and access.argument_types = expected.argument_types
      where actual.oid is null
         or access.function_name is null
         or actual.return_type <> expected.return_type
         or actual.language_name <> expected.language_name
         or actual.owner_name <> expected.owner_name
         or actual.security_definer <> expected.security_definer
         or actual.volatility <> expected.volatility
         or actual.proparallel <> access.parallel_safety
         or actual.proleakproof
         or actual.proconfig is distinct from array['search_path=""']::text[]
         or actual.proacl::text is distinct from access.raw_acl
         or actual.effective_acl <> access.effective_acl
    ) as exact
),
column_contract as (
  select
    pg_catalog.count(*) = (select pg_catalog.count(*) from expected_added_columns)
    and pg_catalog.bool_and(
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
        = expected.type_name
      and attribute.attnotnull = expected.not_null
      and attribute.attidentity = ''
      and attribute.attgenerated = ''
    ) as exact
  from expected_added_columns as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = relation.oid
   and attribute.attname = expected.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
  where attribute.attrelid is not null
),
index_contract as (
  select
    pg_catalog.count(*) = (select pg_catalog.count(*) from expected_indexes)
    and pg_catalog.bool_and(relation.relkind = 'i') as exact
  from expected_indexes as expected
  join pg_catalog.pg_class as relation on relation.relname = expected.index_name
),
trigger_contract as (
  select
    pg_catalog.count(*) = (select pg_catalog.count(*) from expected_triggers)
    and pg_catalog.bool_and(not trigger_row.tgisinternal) as exact
  from expected_triggers as expected
  join pg_catalog.pg_trigger as trigger_row
    on trigger_row.tgname = expected.trigger_name
),
policy_contract as (
  select
    pg_catalog.count(*) = (select pg_catalog.count(*) from expected_policies)
    as exact
  from expected_policies as expected
  join pg_catalog.pg_policy as policy on policy.polname = expected.policy_name
),
grant_contract as (
  select
    not pg_catalog.has_table_privilege(
      'anon',
      'public.line_pay_checkout_attempts',
      'select,insert,update,delete,truncate,references,trigger'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.line_pay_checkout_attempts',
      'select,insert,update,delete,truncate,references,trigger'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.line_pay_payment_audit_events',
      'select,insert,update,delete,truncate,references,trigger'
    )
    and not pg_catalog.has_table_privilege(
      'line_pay_payment_executor',
      'public.payments',
      'select,insert,update,delete,truncate,references,trigger'
    )
    and not pg_catalog.has_schema_privilege(
      'line_pay_payment_executor',
      'public',
      'create'
    )
    and pg_catalog.has_schema_privilege(
      'line_pay_payment_executor',
      'public',
      'usage'
    ) as exact
),
new_relation_rows as (
  select pg_catalog.jsonb_build_object(
    'app_environment_attestation', (select pg_catalog.count(*)::integer from public.app_environment_attestation),
    'line_pay_checkout_attempts', (select pg_catalog.count(*)::integer from public.line_pay_checkout_attempts),
    'line_pay_request_outbox', (select pg_catalog.count(*)::integer from public.line_pay_request_outbox),
    'line_pay_callback_capabilities', (select pg_catalog.count(*)::integer from public.line_pay_callback_capabilities),
    'line_pay_callback_events', (select pg_catalog.count(*)::integer from public.line_pay_callback_events),
    'line_pay_payment_audit_events', (select pg_catalog.count(*)::integer from public.line_pay_payment_audit_events),
    'line_pay_completion_proofs', (select pg_catalog.count(*)::integer from line_pay_private.line_pay_completion_proofs)
  ) as value
),
catalog_rows(category, identity, metadata) as (
  select
    'functions',
    actual.schema_name || '.' || actual.function_name || '(' || actual.argument_types || ')',
    pg_catalog.jsonb_build_array(
      actual.return_type,
      actual.language_name,
      actual.owner_name,
      actual.security_definer,
      actual.volatility,
      actual.proparallel,
      actual.proleakproof,
      to_jsonb(actual.proconfig),
      actual.proacl::text,
      actual.effective_acl,
      pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(actual.prosrc, 'UTF8')),
        'hex'
      ),
      pg_catalog.obj_description(actual.oid, 'pg_proc')
    )
  from function_actual as actual

  union all

  select
    'relations',
    expected.schema_name || '.' || expected.relation_name,
    pg_catalog.jsonb_build_array(
      owner.rolname,
      relation.relkind,
      relation.relpersistence,
      relation.relrowsecurity,
      relation.relforcerowsecurity,
      relation.relreplident,
      relation.relacl::text,
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )::text,
      pg_catalog.obj_description(relation.oid, 'pg_class')
    )
  from expected_relations as expected
  join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
  join pg_catalog.pg_roles as owner on owner.oid = relation.relowner

  union all

  select
    'columns',
    namespace.nspname || '.' || relation.relname || '.' || attribute.attname,
    pg_catalog.jsonb_build_array(
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      attribute.attnotnull,
      pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, false),
      attribute.attidentity,
      attribute.attgenerated,
      attribute.attstorage,
      attribute.attcompression,
      case
        when attribute.attcollation = 0 then null
        else collation_namespace.nspname || '.' || collation_row.collname
      end,
      pg_catalog.col_description(relation.oid, attribute.attnum)
    )
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  left join pg_catalog.pg_attrdef as default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  left join pg_catalog.pg_collation as collation_row
    on collation_row.oid = attribute.attcollation
  left join pg_catalog.pg_namespace as collation_namespace
    on collation_namespace.oid = collation_row.collnamespace
  where attribute.attnum > 0
    and not attribute.attisdropped
    and (
      (namespace.nspname, relation.relname) in (
        select schema_name, relation_name from expected_relations
      )
      or (
        namespace.nspname = 'public'
        and (relation.relname, attribute.attname) in (
          select table_name, column_name from expected_added_columns
        )
      )
    )

  union all

  select
    'constraints',
    namespace.nspname || '.' || relation.relname || '.' ||
      constraint_row.conname,
    pg_catalog.jsonb_build_array(
      constraint_row.contype,
      pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
      constraint_row.convalidated,
      constraint_row.connoinherit,
      constraint_row.condeferrable,
      constraint_row.condeferred,
      constraint_row.conislocal,
      constraint_row.coninhcount,
      constraint_row.conparentid <> 0,
      constraint_row.confupdtype,
      constraint_row.confdeltype,
      constraint_row.confmatchtype,
      pg_catalog.obj_description(constraint_row.oid, 'pg_constraint')
    )
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where
    (namespace.nspname, relation.relname) in (
      select schema_name, relation_name from expected_relations
    )
    or (
      namespace.nspname = 'public'
      and relation.relname in ('payments', 'product_orders')
      and (
        (relation.relname, constraint_row.conname) in (
          select table_name, constraint_name
          from expected_existing_constraints
        )
        or constraint_row.conname like '%line_pay%'
      )
    )

  union all

  select
    'indexes',
    namespace.nspname || '.' || index_relation.relname,
    pg_catalog.jsonb_build_array(
      table_relation.relname,
      index_relation.relkind,
      index_row.indisunique,
      index_row.indisprimary,
      index_row.indisexclusion,
      index_row.indimmediate,
      index_row.indisvalid,
      index_row.indisready,
      index_row.indislive,
      pg_catalog.pg_get_indexdef(index_relation.oid),
      index_relation.relacl::text,
      pg_catalog.obj_description(index_relation.oid, 'pg_class')
    )
  from pg_catalog.pg_index as index_row
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_row.indexrelid
  join pg_catalog.pg_class as table_relation
    on table_relation.oid = index_row.indrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = index_relation.relnamespace
  where
    (namespace.nspname, table_relation.relname) in (
      select schema_name, relation_name from expected_relations
    )
    or index_relation.relname in (
      select index_name from expected_indexes
    )
    or (
      namespace.nspname = 'public'
      and table_relation.relname in ('payments', 'product_orders')
      and index_relation.relname like '%line_pay%'
    )

  union all

  select
    'triggers',
    namespace.nspname || '.' || relation.relname || '.' ||
      trigger_row.tgname,
    pg_catalog.jsonb_build_array(
      trigger_row.tgenabled,
      trigger_row.tgisinternal,
      pg_catalog.pg_get_triggerdef(trigger_row.oid, false),
      pg_catalog.obj_description(trigger_row.oid, 'pg_trigger')
    )
  from pg_catalog.pg_trigger as trigger_row
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where not trigger_row.tgisinternal
    and (
      (namespace.nspname, relation.relname) in (
        select schema_name, relation_name from expected_relations
      )
      or trigger_row.tgname in (
        select trigger_name from expected_triggers
      )
      or (
        namespace.nspname = 'public'
        and relation.relname in ('payments', 'product_orders')
        and trigger_row.tgname like 'line_pay_%'
      )
    )

  union all

  select
    'policies',
    namespace.nspname || '.' || relation.relname || '.' || policy.polname,
    pg_catalog.jsonb_build_array(
      policy.polpermissive,
      policy.polcmd,
      (
        select pg_catalog.jsonb_agg(role.rolname order by role.rolname)
        from pg_catalog.unnest(policy.polroles) as role_oid(oid)
        join pg_catalog.pg_roles as role on role.oid = role_oid.oid
      ),
      pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false),
      pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, false)
    )
  from pg_catalog.pg_policy as policy
  join pg_catalog.pg_class as relation on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where
    (namespace.nspname, relation.relname) in (
      select schema_name, relation_name from expected_relations
    )
    or policy.polname in (
      select policy_name from expected_policies
    )
    or (
      namespace.nspname = 'public'
      and relation.relname in ('payments', 'product_orders')
      and policy.polname like 'line_pay_%'
    )

  union all

  select
    'roles',
    role.rolname,
    pg_catalog.jsonb_build_array(
      role.rolsuper,
      role.rolinherit,
      role.rolcreaterole,
      role.rolcreatedb,
      role.rolcanlogin,
      role.rolreplication,
      role.rolconnlimit,
      role.rolbypassrls,
      to_jsonb(role.rolconfig),
      role.rolvaliduntil
    )
  from expected_roles as expected
  join pg_catalog.pg_roles as role on role.rolname = expected.role_name

  union all

  select
    'schemas',
    namespace.nspname,
    pg_catalog.jsonb_build_array(
      owner.rolname,
      namespace.nspacl::text,
      coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )::text,
      pg_catalog.obj_description(namespace.oid, 'pg_namespace')
    )
  from pg_catalog.pg_namespace as namespace
  join pg_catalog.pg_roles as owner on owner.oid = namespace.nspowner
  where namespace.nspname = 'line_pay_private'

  union all

  select
    'existing_relation_access',
    namespace.nspname || '.' || relation.relname,
    pg_catalog.jsonb_build_array(
      owner.rolname,
      relation.relkind,
      relation.relrowsecurity,
      relation.relforcerowsecurity,
      relation.relacl::text,
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )::text
    )
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join pg_catalog.pg_roles as owner on owner.oid = relation.relowner
  where namespace.nspname = 'public'
    and relation.relname in ('payments', 'product_orders')
),
catalog_fingerprints as (
  select pg_catalog.jsonb_object_agg(
    category,
    pg_catalog.jsonb_build_object(
      'count', row_count,
      'digest', digest
    )
    order by category
  ) as value
  from (
    select
      category,
      pg_catalog.count(*)::integer as row_count,
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                identity || E'\t' || metadata::text,
                E'\n' order by identity
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      ) as digest
    from catalog_rows
    group by category
  ) as grouped
),
line_pay_contract as (
  select pg_catalog.jsonb_build_object(
    'expected_relations_exact', (select exact from relation_contract),
    'private_schema_exact', coalesce((
      select owner.rolname = 'line_pay_payment_function_owner'
      from pg_catalog.pg_namespace as namespace
      join pg_catalog.pg_roles as owner on owner.oid = namespace.nspowner
      where namespace.nspname = 'line_pay_private'
    ), false),
    'dedicated_roles_exact', (select exact from role_contract),
    'functions_exact', (select exact from function_contract),
    'tables_exact', (select exact from relation_contract) and (select exact from column_contract),
    'constraints_exact', not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_row
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = constraint_row.connamespace
      where namespace.nspname in ('public', 'line_pay_private')
        and constraint_row.conname like 'line_pay_%'
        and not constraint_row.convalidated
    ),
    'indexes_exact', (select exact from index_contract),
    'triggers_exact', (select exact from trigger_contract),
    'policies_exact', (select exact from policy_contract),
    'grants_exact', (select exact from grant_contract),
    'unknown_overloads', (
      select (
        pg_catalog.count(*) - (select pg_catalog.count(*) from expected_functions)
      )::integer
      from function_actual
    ),
    'catalog_fingerprints', (select value from catalog_fingerprints),
    'new_relation_rows', (select value from new_relation_rows)
  ) as value
),
fence_relation as (
  select relation.oid, relation.relkind, relation.relrowsecurity, relation.relowner,
    coalesce(
      relation.relacl,
      pg_catalog.acldefault('r', relation.relowner)
    ) as effective_acl
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'bank_transfer_submissions'
),
fence_policy as (
  select
    policy.polname,
    policy.polcmd,
    coalesce(
      (
        select pg_catalog.jsonb_agg(role.rolname order by role.rolname)
        from pg_catalog.unnest(policy.polroles) as role_oid(oid)
        join pg_catalog.pg_roles as role on role.oid = role_oid.oid
      ),
      '[]'::jsonb
    ) as roles,
    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false) as using_expression,
    pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, false) as with_check_expression
  from pg_catalog.pg_policy as policy
  join fence_relation as relation on relation.oid = policy.polrelid
),
fence_acl as (
  select
    coalesce(
      pg_catalog.jsonb_agg(acl.privilege_type order by acl.privilege_type)
        filter (where grantee.rolname = 'authenticated'),
      '[]'::jsonb
    ) as authenticated_acl,
    coalesce(
      pg_catalog.jsonb_agg(acl.privilege_type order by acl.privilege_type)
        filter (where grantee.rolname = 'service_role'),
      '[]'::jsonb
    ) as service_role_acl,
    coalesce(
      pg_catalog.jsonb_agg(acl.privilege_type order by acl.privilege_type)
        filter (where grantee.rolname = 'anon'),
      '[]'::jsonb
    ) as anon_acl,
    coalesce(
      pg_catalog.jsonb_agg(acl.privilege_type order by acl.privilege_type)
        filter (where acl.grantee = 0),
      '[]'::jsonb
    ) as public_acl,
    pg_catalog.count(*) filter (
      where acl.grantee <> relation.relowner
        and coalesce(grantee.rolname, 'PUBLIC') not in (
          'anon', 'authenticated', 'service_role'
        )
        and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    )::integer as unknown_write_acl_count,
    pg_catalog.count(*) filter (
      where acl.grantee <> relation.relowner and acl.is_grantable
    )::integer as grant_option_count
  from fence_relation as relation
  cross join lateral pg_catalog.aclexplode(relation.effective_acl) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  group by relation.relowner
),
fence_contract as (
  select pg_catalog.jsonb_build_object(
    'relation_kind', relation.relkind::text,
    'rls_enabled', relation.relrowsecurity,
    'policy_count', (select pg_catalog.count(*)::integer from fence_policy),
    'policy_name', (select polname from fence_policy limit 1),
    'policy_roles', coalesce((select roles from fence_policy limit 1), '[]'::jsonb),
    'policy_command', (select polcmd::text from fence_policy limit 1),
    'using_expression', (select using_expression from fence_policy limit 1),
    'with_check_expression', (select with_check_expression from fence_policy limit 1),
    'authenticated_acl', acl.authenticated_acl,
    'service_role_acl', acl.service_role_acl,
    'anon_acl', acl.anon_acl,
    'public_acl', acl.public_acl,
    'unknown_write_acl_count', acl.unknown_write_acl_count,
    'grant_option_count', acl.grant_option_count
  ) as value
  from fence_relation as relation
  cross join fence_acl as acl
),
bank_transfer_expected_columns(
  ordinal_position,
  column_name,
  formatted_type,
  is_not_null,
  default_expression,
  generated_kind,
  identity_kind
) as (
  values
    (1, 'id', 'uuid', true, 'gen_random_uuid()', '', ''),
    (2, 'user_id', 'uuid', false, null, '', ''),
    (3, 'item_type', 'text', true, null, '', ''),
    (4, 'item_id', 'text', false, null, '', ''),
    (5, 'item_name', 'text', true, null, '', ''),
    (6, 'amount_twd', 'integer', true, null, '', ''),
    (7, 'payer_name', 'text', true, null, '', ''),
    (8, 'payer_phone', 'text', true, null, '', ''),
    (9, 'payer_email', 'text', false, null, '', ''),
    (10, 'line_display_name', 'text', false, null, '', ''),
    (11, 'bank_account_last5', 'text', true, null, '', ''),
    (12, 'transfer_time', 'timestamp with time zone', false, null, '', ''),
    (13, 'note', 'text', false, null, '', ''),
    (14, 'status', 'text', true, '''pending_review''::text', '', ''),
    (15, 'admin_note', 'text', false, null, '', ''),
    (16, 'created_at', 'timestamp with time zone', false, 'now()', '', ''),
    (17, 'confirmed_at', 'timestamp with time zone', false, null, '', '')
),
bank_transfer_actual_columns as (
  select
    attribute.attnum::integer as ordinal_position,
    attribute.attname::text as column_name,
    pg_catalog.format_type(
      attribute.atttypid,
      attribute.atttypmod
    )::text as formatted_type,
    attribute.attnotnull as is_not_null,
    pg_catalog.pg_get_expr(
      default_row.adbin,
      default_row.adrelid,
      false
    )::text as default_expression,
    attribute.attgenerated::text as generated_kind,
    attribute.attidentity::text as identity_kind
  from fence_relation as relation
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum > 0
   and not attribute.attisdropped
  left join pg_catalog.pg_attrdef as default_row
    on default_row.adrelid = attribute.attrelid
   and default_row.adnum = attribute.attnum
),
bank_transfer_schema_contract as (
  select
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          ordinal_position,
          column_name,
          formatted_type,
          is_not_null,
          default_expression,
          generated_kind,
          identity_kind
        )
        order by ordinal_position
      )
      from bank_transfer_expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          ordinal_position,
          column_name,
          formatted_type,
          is_not_null,
          default_expression,
          generated_kind,
          identity_kind
        )
        order by ordinal_position
      )
      from bank_transfer_actual_columns
    )
    and not exists (
      select 1
      from fence_relation as relation
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
      where attribute.attnum > 0
        and attribute.attisdropped
    ) as exact,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            (
              select pg_catalog.string_agg(
                pg_catalog.jsonb_build_array(
                  ordinal_position,
                  column_name,
                  formatted_type,
                  is_not_null,
                  default_expression,
                  generated_kind,
                  identity_kind
                )::text,
                E'\n'
                order by ordinal_position
              )
              from bank_transfer_actual_columns
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as signature
),
bank_transfer_canonical_rows as (
  select
    row_value.id,
    row_value.status,
    pg_catalog.row_number() over (order by row_value.id)::integer as ordinal,
    pg_catalog.jsonb_build_object(
      'id', row_value.id,
      'user_id', row_value.user_id,
      'item_type', row_value.item_type,
      'item_id', row_value.item_id,
      'item_name', row_value.item_name,
      'amount_twd', row_value.amount_twd
    ) as identity_and_amount,
    pg_catalog.jsonb_build_object(
      'id', row_value.id,
      'payer_name', row_value.payer_name,
      'payer_phone', row_value.payer_phone,
      'payer_email', row_value.payer_email,
      'line_display_name', row_value.line_display_name
    ) as payer_contact,
    pg_catalog.jsonb_build_object(
      'id', row_value.id,
      'bank_account_last5', row_value.bank_account_last5,
      'transfer_time', row_value.transfer_time,
      'note', row_value.note
    ) as transfer_details,
    pg_catalog.jsonb_build_object(
      'id', row_value.id,
      'status', row_value.status,
      'admin_note', row_value.admin_note,
      'created_at', row_value.created_at,
      'confirmed_at', row_value.confirmed_at
    ) as review_and_confirmation,
    pg_catalog.jsonb_build_object(
      'id', row_value.id,
      'user_id', row_value.user_id,
      'item_type', row_value.item_type,
      'item_id', row_value.item_id,
      'item_name', row_value.item_name,
      'amount_twd', row_value.amount_twd,
      'payer_name', row_value.payer_name,
      'payer_phone', row_value.payer_phone,
      'payer_email', row_value.payer_email,
      'line_display_name', row_value.line_display_name,
      'bank_account_last5', row_value.bank_account_last5,
      'transfer_time', row_value.transfer_time,
      'note', row_value.note,
      'status', row_value.status,
      'admin_note', row_value.admin_note,
      'created_at', row_value.created_at,
      'confirmed_at', row_value.confirmed_at
    ) as full_canonical_row
  from public.bank_transfer_submissions as row_value
),
bank_transfer_row_digests as (
  select
    id,
    ordinal,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(identity_and_amount::text, 'UTF8')
      ),
      'hex'
    ) as identity_and_amount,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(payer_contact::text, 'UTF8')
      ),
      'hex'
    ) as payer_contact,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transfer_details::text, 'UTF8')
      ),
      'hex'
    ) as transfer_details,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(review_and_confirmation::text, 'UTF8')
      ),
      'hex'
    ) as review_and_confirmation,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(full_canonical_row::text, 'UTF8')
      ),
      'hex'
    ) as full_canonical_row
  from bank_transfer_canonical_rows
),
bank_transfer_aggregate_digests as (
  select
    pg_catalog.count(*)::integer as row_count,
    pg_catalog.count(*) filter (
      where row_value.status = 'pending_review'
    )::integer as pending_review_count,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              row_value.id::text,
              E'\n'
              order by row_value.id
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as pk_digest,
    pg_catalog.jsonb_build_object(
      'identity_and_amount',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                row_value.identity_and_amount::text,
                E'\n'
                order by row_value.id
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      ),
      'payer_contact',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                row_value.payer_contact::text,
                E'\n'
                order by row_value.id
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      ),
      'transfer_details',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                row_value.transfer_details::text,
                E'\n'
                order by row_value.id
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      ),
      'review_and_confirmation',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                row_value.review_and_confirmation::text,
                E'\n'
                order by row_value.id
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      ),
      'full_canonical_row',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            coalesce(
              pg_catalog.string_agg(
                row_value.full_canonical_row::text,
                E'\n'
                order by row_value.id
              ),
              ''
            ),
            'UTF8'
          )
        ),
        'hex'
      )
    ) as group_digests
  from bank_transfer_canonical_rows as row_value
),
bank_transfer_contract as (
  select pg_catalog.jsonb_build_object(
    'schema_signature_match',
    coalesce(
      schema_contract.exact
      and pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(schema_contract.signature, 'UTF8')
        ),
        'hex'
      ) = '45d35856ba4ee300e196c562eb8e0e9b37dde94d3bb9d148248163827e005a04',
      false
    ),
    'row_count_match', aggregate.row_count = 3,
    'pending_review_count_match', aggregate.pending_review_count = 3,
    'pk_digest_match',
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(aggregate.pk_digest, 'UTF8')
      ),
      'hex'
    ) = '4346bb9d65f1fe16ae98a26821e857bf49b158e12ac4e47d251380e6bc518199',
    'group_matches',
    pg_catalog.jsonb_build_object(
      'identity_and_amount',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            aggregate.group_digests ->> 'identity_and_amount',
            'UTF8'
          )
        ),
        'hex'
      ) = '61ed62d26b2ffd626b1d494602b10700f6d79cf000ec7045261fbee44cff2c2c',
      'payer_contact',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            aggregate.group_digests ->> 'payer_contact',
            'UTF8'
          )
        ),
        'hex'
      ) = '5eed83932fd5acd6a6c8fd1a7c8552e8d6c0f4bf67186b096ad702f1fff54c78',
      'transfer_details',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            aggregate.group_digests ->> 'transfer_details',
            'UTF8'
          )
        ),
        'hex'
      ) = '624fe68a4f252e1128bbdf83e37050e4fbebc3b32828347fd10e5503cc93eb1b',
      'review_and_confirmation',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            aggregate.group_digests ->> 'review_and_confirmation',
            'UTF8'
          )
        ),
        'hex'
      ) = '0e04c05d7edca9319b6fee5837e186916eded596e9d31a51cfd9d68251524271',
      'full_canonical_row',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            aggregate.group_digests ->> 'full_canonical_row',
            'UTF8'
          )
        ),
        'hex'
      ) = 'd8ad6430e739d8a3d6d9b8f8d81680b2602313fa2f6b7662753331dda5fc93be'
    ),
    'ordinal_matches',
    pg_catalog.jsonb_build_object(
      'ordinal_1',
      pg_catalog.jsonb_build_object(
        'identity_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(identity_and_amount, 'UTF8')),
            'hex'
          ) = '8054981959cf9095b36e19da0eea06e34d0b8f8f10379dc9313604e240a7db04'
          from bank_transfer_row_digests where ordinal = 1
        ), false),
        'contact_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(payer_contact, 'UTF8')),
            'hex'
          ) = 'f8172854e648abb71491098bb787edfd1b842f52b55c7631b91d8dcb3b14ed94'
          from bank_transfer_row_digests where ordinal = 1
        ), false),
        'transfer_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(transfer_details, 'UTF8')),
            'hex'
          ) = 'bb6eea7c32aa16e55702e7eb058a7df3cebbbf631433d0c842b1aae135d1f79f'
          from bank_transfer_row_digests where ordinal = 1
        ), false),
        'review_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(review_and_confirmation, 'UTF8')),
            'hex'
          ) = 'af75de6e16537e03fe5b9f1d905120e8cb84d7282de023357e0875b7e116d203'
          from bank_transfer_row_digests where ordinal = 1
        ), false),
        'full_row_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(full_canonical_row, 'UTF8')),
            'hex'
          ) = '77df43c18d57e3bb83ad9e285e14ca6429b50f177a353004170cf9863e849bb6'
          from bank_transfer_row_digests where ordinal = 1
        ), false)
      ),
      'ordinal_2',
      pg_catalog.jsonb_build_object(
        'identity_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(identity_and_amount, 'UTF8')),
            'hex'
          ) = '41c0c3b20913fc951ad85057631d462e43f8e6ca335a0eb62c52685aa067d144'
          from bank_transfer_row_digests where ordinal = 2
        ), false),
        'contact_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(payer_contact, 'UTF8')),
            'hex'
          ) = '6a751378fd21bc0574cfa1b412ce1cdd8682505eaf07dacfe0cd0a67893f85b3'
          from bank_transfer_row_digests where ordinal = 2
        ), false),
        'transfer_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(transfer_details, 'UTF8')),
            'hex'
          ) = '7e5639668922d5c1ef7e3d0be137bd98a2ccd63b27746984b79f5ee6bde1f0c7'
          from bank_transfer_row_digests where ordinal = 2
        ), false),
        'review_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(review_and_confirmation, 'UTF8')),
            'hex'
          ) = '1db2ac98556bf945c15586491b5d5f844acf3b767fef307101a401877cbc7677'
          from bank_transfer_row_digests where ordinal = 2
        ), false),
        'full_row_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(full_canonical_row, 'UTF8')),
            'hex'
          ) = 'ad26153aa542a4310306d00da5c30fc3f3aff75fc71ce4e5385eae804059f514'
          from bank_transfer_row_digests where ordinal = 2
        ), false)
      ),
      'ordinal_3',
      pg_catalog.jsonb_build_object(
        'identity_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(identity_and_amount, 'UTF8')),
            'hex'
          ) = 'df58063e371c4dc75807b1426f407119a3cd71241d972ee68177b1e8d754a4ab'
          from bank_transfer_row_digests where ordinal = 3
        ), false),
        'contact_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(payer_contact, 'UTF8')),
            'hex'
          ) = 'a1d83ac319167825ab16544ff9a27124639371156607727eabc80a6b8e13f29e'
          from bank_transfer_row_digests where ordinal = 3
        ), false),
        'transfer_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(transfer_details, 'UTF8')),
            'hex'
          ) = 'f1c8ca740c542cb6b51c330f8125aef55c89289f434058c9516d7558404975b6'
          from bank_transfer_row_digests where ordinal = 3
        ), false),
        'review_group_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(review_and_confirmation, 'UTF8')),
            'hex'
          ) = '73396a621108b90cf62be896452e3f4a44191f97febd055e10fd28af3a50b1bf'
          from bank_transfer_row_digests where ordinal = 3
        ), false),
        'full_row_match', coalesce((
          select pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(full_canonical_row, 'UTF8')),
            'hex'
          ) = '782b67bbfb65e1819a24002a0ce4ecd7ab50396e1cf62fe4e8dc8913bb666772'
          from bank_transfer_row_digests where ordinal = 3
        ), false)
      )
    )
  ) as value
  from bank_transfer_schema_contract as schema_contract
  cross join bank_transfer_aggregate_digests as aggregate
),
\if :{?line_pay_baseline_manifest}
payments_baseline_manifest as (
  select id, row_hash
  from pg_catalog.jsonb_each_text(
    :'baseline_payments_manifest'::jsonb
  ) as manifest(id, row_hash)
),
payments_current_manifest as (
  select
    row_value.id::text as id,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'id', row_value.id,
            'user_id', row_value.user_id,
            'booking_id', row_value.booking_id,
            'provider', row_value.provider,
            'provider_payment_id', row_value.provider_payment_id,
            'item_type', row_value.item_type,
            'item_name', row_value.item_name,
            'amount_twd', row_value.amount_twd,
            'currency', row_value.currency,
            'status', row_value.status,
            'paid_at', row_value.paid_at,
            'refunded_at', row_value.refunded_at,
            'raw_payload', row_value.raw_payload,
            'created_at', row_value.created_at,
            'item_id', row_value.item_id,
            'merchant_order_no', row_value.merchant_order_no,
            'provider_trade_no', row_value.provider_trade_no,
            'notify_received_at', row_value.notify_received_at,
            'failure_reason', row_value.failure_reason
          )::text,
          'UTF8'
        )
      ),
      'hex'
    ) as row_hash
  from public.payments as row_value
),
payments_manifest_contract as (
  select pg_catalog.jsonb_build_object(
    'manifest_complete',
    pg_catalog.jsonb_typeof(:'baseline_payments_manifest'::jsonb) = 'object'
      and (
        select pg_catalog.count(*)::integer
        from pg_catalog.jsonb_object_keys(
          :'baseline_payments_manifest'::jsonb
        )
      ) = :'baseline_payments_row_count'::integer
      and not exists (
        select 1
        from payments_baseline_manifest
        where row_hash !~ '^[0-9a-f]{64}$'
      ),
    'no_missing_rows',
    not exists (
      select 1
      from payments_baseline_manifest as baseline
      left join payments_current_manifest as current using (id)
      where current.id is null
    ),
    'no_unexpected_rows',
    (select pg_catalog.count(*) from payments_current_manifest)
      = :'baseline_payments_row_count'::integer
      and not exists (
        select 1
        from payments_current_manifest as current
        left join payments_baseline_manifest as baseline using (id)
        where baseline.id is null
      ),
    'business_fields_unchanged',
    not exists (
      select 1
      from payments_baseline_manifest as baseline
      left join payments_current_manifest as current using (id)
      where current.id is null or current.row_hash <> baseline.row_hash
    )
  ) as value
),
product_orders_baseline_manifest as (
  select id, row_hash
  from pg_catalog.jsonb_each_text(
    :'baseline_product_orders_manifest'::jsonb
  ) as manifest(id, row_hash)
),
product_orders_current_manifest as (
  select
    row_value.id::text as id,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'id', row_value.id,
            'order_no', row_value.order_no,
            'user_id', row_value.user_id,
            'customer_name', row_value.customer_name,
            'customer_email', row_value.customer_email,
            'customer_phone', row_value.customer_phone,
            'total_amount_twd', row_value.total_amount_twd,
            'payment_method', row_value.payment_method,
            'payment_status', row_value.payment_status,
            'order_status', row_value.order_status,
            'shipping_status', row_value.shipping_status,
            'payment_id', row_value.payment_id,
            'bank_transfer_submission_id',
              row_value.bank_transfer_submission_id,
            'note', row_value.note,
            'created_at', row_value.created_at,
            'updated_at', row_value.updated_at
          )::text,
          'UTF8'
        )
      ),
      'hex'
    ) as row_hash
  from public.product_orders as row_value
),
product_orders_manifest_contract as (
  select pg_catalog.jsonb_build_object(
    'manifest_complete',
    pg_catalog.jsonb_typeof(
      :'baseline_product_orders_manifest'::jsonb
    ) = 'object'
      and (
        select pg_catalog.count(*)::integer
        from pg_catalog.jsonb_object_keys(
          :'baseline_product_orders_manifest'::jsonb
        )
      ) = :'baseline_product_orders_row_count'::integer
      and not exists (
        select 1
        from product_orders_baseline_manifest
        where row_hash !~ '^[0-9a-f]{64}$'
      ),
    'no_missing_rows',
    not exists (
      select 1
      from product_orders_baseline_manifest as baseline
      left join product_orders_current_manifest as current using (id)
      where current.id is null
    ),
    'no_unexpected_rows',
    (select pg_catalog.count(*) from product_orders_current_manifest)
      = :'baseline_product_orders_row_count'::integer
      and not exists (
        select 1
        from product_orders_current_manifest as current
        left join product_orders_baseline_manifest as baseline using (id)
        where baseline.id is null
      ),
    'business_fields_unchanged',
    not exists (
      select 1
      from product_orders_baseline_manifest as baseline
      left join product_orders_current_manifest as current using (id)
      where current.id is null or current.row_hash <> baseline.row_hash
    )
  ) as value
),
\else
payments_manifest_contract as (
  select '{
    "manifest_complete":false,
    "no_missing_rows":false,
    "no_unexpected_rows":false,
    "business_fields_unchanged":false
  }'::jsonb as value
),
product_orders_manifest_contract as (
  select '{
    "manifest_complete":false,
    "no_missing_rows":false,
    "no_unexpected_rows":false,
    "business_fields_unchanged":false
  }'::jsonb as value
),
\endif
historical_contract as (
  select pg_catalog.jsonb_build_object(
    'bank_transfer', (select value from bank_transfer_contract),
    'payments', (select value from payments_manifest_contract),
    'product_orders', (select value from product_orders_manifest_contract)
  ) as value
),
migration_history_contract as (
  select
    pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null
      as line_pay_version_present
),
assembled as (
  select
    to_jsonb(database_contract) as database,
    (select value from line_pay_contract) as line_pay,
    (select value from fence_contract) as fence,
    (select value from historical_contract) as historical,
    to_jsonb(migration_history_contract) as migration_history
  from database_contract
  cross join migration_history_contract
),
classified as (
  select
    case
      when database = '{"name":"postgres","major":17,"recovery":false}'::jsonb
       and line_pay = '{
         "expected_relations_exact":true,
         "private_schema_exact":true,
         "dedicated_roles_exact":true,
         "functions_exact":true,
         "tables_exact":true,
         "constraints_exact":true,
         "indexes_exact":true,
         "triggers_exact":true,
         "policies_exact":true,
         "grants_exact":true,
         "unknown_overloads":0,
         "catalog_fingerprints":{
           "roles":{"count":2,"digest":"786d1c5ca588b748675bdf743ca951a1e6257d965510e07ce416af73b12e0d52"},
           "columns":{"count":127,"digest":"912bb632ea158c789e9d888be2fc2d4bdfbc916c53ff15a04bf91129e6ad31e3"},
           "indexes":{"count":39,"digest":"1b46355b945fd1b645515cafa42953da7d97a73441ddb607e35712735299ea05"},
           "schemas":{"count":1,"digest":"7f4bc5f9792e18737278e4014cf568d3984d9a2eee712f15c10ce7dd14dfd278"},
           "policies":{"count":14,"digest":"82835fd30a53aa319123d691a0cd46742b9b28da77b5cf44eceebdcb82aed915"},
           "triggers":{"count":11,"digest":"110eb112b655178d1d1f2d0ee1d67ac0966a37efff2ca8cf8c15eb8747f5899e"},
           "functions":{"count":21,"digest":"a63fb3c9d868be844ff836d655d5c96ec77b1b79eda85869d8a6251279f4ee85"},
           "relations":{"count":7,"digest":"d4d62e30c89763b49e6c33c77c4b3d6f38a1921848bdda5144ccaec9cc12407f"},
           "constraints":{"count":115,"digest":"8a78fcbe6ca7e07e8cd9bd560da6fdea601ce09b825948bb9b1d1de33e86bcb6"},
           "existing_relation_access":{"count":2,"digest":"9e8052b3233f19df10341fce5fd6737f926c63105e3a6aa8d30ea97a11e39a8c"}
         },
         "new_relation_rows":{
           "app_environment_attestation":0,
           "line_pay_checkout_attempts":0,
           "line_pay_request_outbox":0,
           "line_pay_callback_capabilities":0,
           "line_pay_callback_events":0,
           "line_pay_payment_audit_events":0,
           "line_pay_completion_proofs":0
         }
       }'::jsonb
       and fence = '{
         "relation_kind":"r",
         "rls_enabled":true,
         "policy_count":1,
         "policy_name":"Users can read own bank transfer submissions",
         "policy_roles":["authenticated"],
         "policy_command":"r",
         "using_expression":"(( SELECT auth.uid() AS uid) = user_id)",
         "with_check_expression":null,
         "authenticated_acl":["SELECT"],
         "service_role_acl":["SELECT"],
         "anon_acl":[],
         "public_acl":[],
         "unknown_write_acl_count":0,
         "grant_option_count":0
       }'::jsonb
       and historical = '{
         "bank_transfer":{
           "schema_signature_match":true,
           "row_count_match":true,
           "pending_review_count_match":true,
           "pk_digest_match":true,
           "group_matches":{
             "identity_and_amount":true,
             "payer_contact":true,
             "transfer_details":true,
             "review_and_confirmation":true,
             "full_canonical_row":true
           },
           "ordinal_matches":{
             "ordinal_1":{
               "identity_group_match":true,
               "contact_group_match":true,
               "transfer_group_match":true,
               "review_group_match":true,
               "full_row_match":true
             },
             "ordinal_2":{
               "identity_group_match":true,
               "contact_group_match":true,
               "transfer_group_match":true,
               "review_group_match":true,
               "full_row_match":true
             },
             "ordinal_3":{
               "identity_group_match":true,
               "contact_group_match":true,
               "transfer_group_match":true,
               "review_group_match":true,
               "full_row_match":true
             }
           }
         },
         "payments":{
           "manifest_complete":true,
           "no_missing_rows":true,
           "no_unexpected_rows":true,
           "business_fields_unchanged":true
         },
         "product_orders":{
           "manifest_complete":true,
           "no_missing_rows":true,
           "no_unexpected_rows":true,
           "business_fields_unchanged":true
         }
       }'::jsonb
       and migration_history = '{"line_pay_version_present":false}'::jsonb
        then 'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED'
      else 'POSTFLIGHT_CONTRACT_FAILED'
    end as status,
    assembled.*
  from assembled
)
select pg_catalog.jsonb_build_object(
  'status', status,
  'database', database,
  'line_pay', line_pay,
  'fence', fence,
  'historical', historical,
  'migration_history', migration_history,
  'runtime_enabled', false
) as audit_result
from classified;
