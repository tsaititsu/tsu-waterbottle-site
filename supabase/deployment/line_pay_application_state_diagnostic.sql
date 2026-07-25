\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

select (
  pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null
) as migration_history_table_present
\gset

\if :migration_history_table_present
select exists (
  select 1
  from supabase_migrations.schema_migrations
  where version = '20260719033404'
) as migration_history_version_present
\gset
\else
\set migration_history_version_present false
\endif

with
expected_relations(schema_name, relation_name) as (
  values
    ('public', 'app_environment_attestation'),
    ('public', 'line_pay_checkout_attempts'),
    ('public', 'line_pay_request_outbox'),
    ('public', 'line_pay_callback_capabilities'),
    ('public', 'line_pay_callback_events'),
    ('public', 'line_pay_payment_audit_events'),
    ('line_pay_private', 'line_pay_completion_proofs')
),
expected_functions(schema_name, function_name) as (
  values
    ('public', 'line_pay_sanitized_result_is_valid'),
    ('public', 'line_pay_audit_evidence_is_valid'),
    ('public', 'line_pay_touch_updated_at'),
    ('public', 'line_pay_enforce_attempt_transition'),
    ('public', 'line_pay_enforce_payment_transition'),
    ('public', 'line_pay_enforce_product_order_transition'),
    ('public', 'line_pay_enforce_outbox_transition'),
    ('public', 'line_pay_enforce_callback_capability_transition'),
    ('public', 'line_pay_enforce_callback_event_transition'),
    ('public', 'claim_product_order_line_pay_request'),
    ('public', 'record_product_order_line_pay_request_success'),
    ('public', 'record_product_order_line_pay_request_failure'),
    ('public', 'mark_product_order_line_pay_request_unknown'),
    ('public', 'read_product_order_line_pay_request_result'),
    ('public', 'claim_line_pay_callback_capability'),
    ('public', 'claim_product_order_line_pay_confirmation'),
    ('public', 'record_product_order_line_pay_confirmation_evidence'),
    ('public', 'complete_product_order_line_pay_confirmation'),
    ('public', 'cancel_product_order_line_pay_payment'),
    ('public', 'mark_product_order_line_pay_reconciliation'),
    ('line_pay_private', 'line_pay_enforce_completion_proof')
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
expected_added_columns(table_name, column_name) as (
  values
    ('product_orders', 'environment'),
    ('product_orders', 'fulfillment_mode'),
    ('product_orders', 'sandbox_test'),
    ('product_orders', 'currency'),
    ('product_orders', 'checkout_attempt_id'),
    ('product_orders', 'payment_request_state'),
    ('product_orders', 'reconciliation_required'),
    ('product_orders', 'state_version'),
    ('payments', 'product_order_id'),
    ('payments', 'environment'),
    ('payments', 'checkout_attempt_id'),
    ('payments', 'request_state'),
    ('payments', 'request_idempotency_key'),
    ('payments', 'request_body_sha256'),
    ('payments', 'line_pay_transaction_id'),
    ('payments', 'reconciliation_required'),
    ('payments', 'state_version')
),
expected_roles(role_name) as (
  values
    ('line_pay_payment_executor'),
    ('line_pay_payment_function_owner')
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
expected_new_constraints(constraint_name) as (
  values
    ('product_orders_environment_check'),
    ('product_orders_fulfillment_mode_check'),
    ('product_orders_currency_check'),
    ('product_orders_payment_request_state_check'),
    ('product_orders_state_version_check'),
    ('product_orders_line_pay_owner_check'),
    ('product_orders_line_pay_environment_check'),
    ('product_orders_sandbox_fulfillment_check'),
    ('product_orders_line_pay_reconciliation_check'),
    ('product_orders_checkout_attempt_id_fkey'),
    ('payments_product_order_id_fkey'),
    ('payments_environment_check'),
    ('payments_request_state_check'),
    ('payments_request_body_sha256_check'),
    ('payments_request_idempotency_key_check'),
    ('payments_line_pay_transaction_id_check'),
    ('payments_state_version_check'),
    ('payments_line_pay_contract_check'),
    ('payments_line_pay_reconciliation_check'),
    ('payments_checkout_attempt_id_fkey')
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
catalog_rows(category, identity, metadata) as (
  select
    'functions',
    actual.schema_name || '.' || actual.function_name || '(' ||
      actual.argument_types || ')',
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
),
expected_fingerprints(category, row_count, digest) as (
  values
    ('roles', 2, '786d1c5ca588b748675bdf743ca951a1e6257d965510e07ce416af73b12e0d52'),
    ('columns', 127, '912bb632ea158c789e9d888be2fc2d4bdfbc916c53ff15a04bf91129e6ad31e3'),
    ('indexes', 39, '1b46355b945fd1b645515cafa42953da7d97a73441ddb607e35712735299ea05'),
    ('schemas', 1, '7f4bc5f9792e18737278e4014cf568d3984d9a2eee712f15c10ce7dd14dfd278'),
    ('policies', 14, '82835fd30a53aa319123d691a0cd46742b9b28da77b5cf44eceebdcb82aed915'),
    ('triggers', 11, '110eb112b655178d1d1f2d0ee1d67ac0966a37efff2ca8cf8c15eb8747f5899e'),
    ('functions', 21, 'a63fb3c9d868be844ff836d655d5c96ec77b1b79eda85869d8a6251279f4ee85'),
    ('relations', 7, 'd4d62e30c89763b49e6c33c77c4b3d6f38a1921848bdda5144ccaec9cc12407f'),
    ('constraints', 115, '8a78fcbe6ca7e07e8cd9bd560da6fdea601ce09b825948bb9b1d1de33e86bcb6'),
    ('existing_relation_access', 2, '9e8052b3233f19df10341fce5fd6737f926c63105e3a6aa8d30ea97a11e39a8c')
),
category_contracts as (
  select
    expected.category,
    coalesce(actual.row_count, 0) as row_count,
    coalesce(
      actual.row_count = expected.row_count
        and actual.digest = expected.digest,
      false
    ) as complete
  from expected_fingerprints as expected
  left join catalog_fingerprints as actual using (category)
),
role_integrity as (
  select
    not exists (
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
    ) as complete
),
inventory as (
  select
    (
      select pg_catalog.count(*)::integer
      from expected_relations as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
    ) as relations_present,
    (
      select pg_catalog.count(*)::integer
      from function_actual
    ) as functions_present,
    (
      select coalesce(row_count, 0)
      from category_contracts
      where category = 'triggers'
    ) as triggers_present,
    (
      select coalesce(row_count, 0)
      from category_contracts
      where category = 'indexes'
    ) as indexes_present,
    (
      select coalesce(row_count, 0)
      from category_contracts
      where category = 'policies'
    ) as policies_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_attribute as attribute
      join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
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
    ) as columns_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_constraint as constraint_row
      join pg_catalog.pg_class as relation
        on relation.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where (namespace.nspname, relation.relname) in (
        select schema_name, relation_name from expected_relations
      )
      or (
        namespace.nspname = 'public'
        and relation.relname in ('payments', 'product_orders')
        and constraint_row.conname in (
          select constraint_name from expected_new_constraints
        )
      )
    ) as constraints_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_roles
      where rolname in (select role_name from expected_roles)
    ) as roles_present,
    exists (
      select 1
      from pg_catalog.pg_namespace
      where nspname = 'line_pay_private'
    ) as private_schema_present
),
contracts as (
  select
    (
      select complete from category_contracts where category = 'relations'
    ) and (
      select complete from category_contracts where category = 'schemas'
    ) as relations_complete,
    (
      select complete from category_contracts where category = 'functions'
    ) as functions_complete,
    (
      select complete from category_contracts where category = 'triggers'
    ) as triggers_complete,
    (
      select complete from category_contracts where category = 'indexes'
    ) as indexes_complete,
    (
      select complete from category_contracts where category = 'policies'
    ) as policies_complete,
    (
      select complete from category_contracts where category = 'columns'
    ) as columns_complete,
    (
      select complete from category_contracts where category = 'constraints'
    ) as constraints_complete,
    (
      select complete from category_contracts where category = 'roles'
    ) and (
      select complete from role_integrity
    ) as roles_complete,
    (
      select complete from category_contracts where category = 'functions'
    ) and (
      select complete from category_contracts where category = 'relations'
    ) and (
      select complete from category_contracts where category = 'schemas'
    ) and (
      select complete
      from category_contracts
      where category = 'existing_relation_access'
    ) as acl_complete
),
evidence as (
  select
    inventory.*,
    contracts.*,
    not inventory.private_schema_present
      and inventory.relations_present = 0
      and inventory.functions_present = 0
      and inventory.triggers_present = 0
      and inventory.indexes_present = 0
      and inventory.policies_present = 0
      and inventory.columns_present = 0
      and inventory.constraints_present = 0
      and inventory.roles_present = 0 as inventory_empty,
    contracts.relations_complete
      and contracts.functions_complete
      and contracts.triggers_complete
      and contracts.indexes_complete
      and contracts.policies_complete
      and contracts.columns_complete
      and contracts.constraints_complete
      and contracts.roles_complete
      and contracts.acl_complete as contracts_complete
  from inventory
  cross join contracts
),
classified as (
  select
    case
      when evidence.contracts_complete
       and :'migration_history_version_present'::boolean
        then 'FULL_WITH_HISTORY'
      when evidence.contracts_complete
       and not :'migration_history_version_present'::boolean
        then 'FULL_WITHOUT_HISTORY'
      when not evidence.contracts_complete
       and :'migration_history_version_present'::boolean
       and evidence.inventory_empty
        then 'HISTORY_ONLY'
      when not evidence.contracts_complete
       and not :'migration_history_version_present'::boolean
       and evidence.inventory_empty
        then 'UNAPPLIED'
      when not evidence.contracts_complete
       and not :'migration_history_version_present'::boolean
       and not evidence.inventory_empty
        then 'PARTIAL'
      else 'INCONSISTENT'
    end as application_state,
    evidence.*
  from evidence
)
select pg_catalog.jsonb_build_object(
  'status', 'APPLICATION_STATE_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    pg_catalog.current_database() = 'postgres'
    and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
    and not pg_catalog.pg_is_in_recovery(),
  'migration_history', pg_catalog.jsonb_build_object(
    'table_present', :'migration_history_table_present'::boolean,
    'version_present', :'migration_history_version_present'::boolean
  ),
  'inventory', pg_catalog.jsonb_build_object(
    'relations_present', relations_present,
    'functions_present', functions_present,
    'triggers_present', triggers_present,
    'indexes_present', indexes_present,
    'policies_present', policies_present,
    'columns_present', columns_present,
    'constraints_present', constraints_present,
    'roles_present', roles_present
  ),
  'contracts', pg_catalog.jsonb_build_object(
    'relations_complete', relations_complete,
    'functions_complete', functions_complete,
    'triggers_complete', triggers_complete,
    'indexes_complete', indexes_complete,
    'policies_complete', policies_complete,
    'columns_complete', columns_complete,
    'constraints_complete', constraints_complete,
    'roles_complete', roles_complete,
    'acl_complete', acl_complete
  ),
  'application_state', application_state
) as audit_result
from classified;

ROLLBACK;
