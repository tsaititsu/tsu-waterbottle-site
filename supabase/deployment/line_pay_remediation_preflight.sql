with
database_contract as (
  select
    pg_catalog.current_database() as name,
    pg_catalog.current_setting('server_version_num')::integer / 10000 as major,
    pg_catalog.pg_is_in_recovery() as recovery
),
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
expected_line_pay_constraints(constraint_name) as (
  values
    ('product_orders_environment_not_null_check'),
    ('product_orders_fulfillment_mode_not_null_check'),
    ('product_orders_sandbox_test_not_null_check'),
    ('product_orders_currency_not_null_check'),
    ('product_orders_reconciliation_not_null_check'),
    ('product_orders_state_version_not_null_check'),
    ('product_orders_environment_check'),
    ('product_orders_fulfillment_mode_check'),
    ('product_orders_currency_check'),
    ('product_orders_payment_request_state_check'),
    ('product_orders_state_version_check'),
    ('product_orders_line_pay_owner_check'),
    ('product_orders_line_pay_environment_check'),
    ('product_orders_sandbox_fulfillment_check'),
    ('product_orders_line_pay_reconciliation_check'),
    ('payments_environment_not_null_check'),
    ('payments_reconciliation_not_null_check'),
    ('payments_state_version_not_null_check'),
    ('payments_product_order_id_fkey'),
    ('payments_environment_check'),
    ('payments_request_state_check'),
    ('payments_request_body_sha256_check'),
    ('payments_request_idempotency_key_check'),
    ('payments_line_pay_transaction_id_check'),
    ('payments_state_version_check'),
    ('payments_line_pay_contract_check'),
    ('payments_line_pay_reconciliation_check')
),
line_pay_inventory as (
  select
    (
      select pg_catalog.count(*)::integer
      from expected_relations as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
       and relation.relkind in ('r', 'p')
    ) as expected_relations_present,
    exists (
      select 1
      from pg_catalog.pg_namespace
      where nspname = 'line_pay_private'
    ) as private_schema_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_roles
      where rolname in (
        'line_pay_payment_executor',
        'line_pay_payment_function_owner'
      )
    ) as dedicated_roles_present,
    (
      select pg_catalog.count(*)::integer
      from expected_functions as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_proc as procedure
        on procedure.pronamespace = namespace.oid
       and procedure.proname = expected.function_name
    ) as functions_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_trigger
      where not tgisinternal
        and tgname in (
          'line_pay_checkout_attempts_touch_updated_at',
          'line_pay_request_outbox_touch_updated_at',
          'line_pay_request_outbox_transition_guard',
          'line_pay_callback_capabilities_touch_updated_at',
          'line_pay_callback_capabilities_transition_guard',
          'line_pay_callback_events_touch_updated_at',
          'line_pay_callback_events_transition_guard',
          'line_pay_checkout_attempts_transition_guard',
          'line_pay_payments_transition_guard',
          'line_pay_product_orders_transition_guard',
          'line_pay_completion_proofs_guard'
        )
    ) as triggers_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_class
      where relkind = 'i'
        and (
          relname like 'line_pay_%'
          or relname in (
            'product_orders_owner_id_idx',
            'product_orders_checkout_attempt_id_idx',
            'payments_product_order_owner_idx',
            'payments_checkout_attempt_id_idx',
            'payments_line_pay_idempotency_idx',
            'payments_line_pay_transaction_idx'
          )
        )
    ) as indexes_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_policy
      where polname like 'line_pay_payment_function_owner_%'
    ) as policies_present,
    (
      select pg_catalog.count(*)::integer
      from expected_added_columns as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = 'public'
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.table_name
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
       and attribute.attname = expected.column_name
       and attribute.attnum > 0
       and not attribute.attisdropped
    ) as added_columns_present,
    (
      select pg_catalog.count(*)::integer
      from expected_line_pay_constraints as expected
      join pg_catalog.pg_constraint as constraint_row
        on constraint_row.conname = expected.constraint_name
    ) as constraints_present
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
bank_transfer_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.count(*) filter (where status = 'pending_review')::integer as pending_review,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(id::text, E'\n' order by id),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(to_jsonb(row_value)::text, E'\n' order by id),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as content_digest
  from public.bank_transfer_submissions as row_value
),
payments_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(id::text, E'\n' order by id),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(
            (to_jsonb(row_value) - 'updated_at')::text,
            E'\n' order by id
          ),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as content_digest
  from public.payments as row_value
),
product_orders_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(id::text, E'\n' order by id),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(
          pg_catalog.string_agg(to_jsonb(row_value)::text, E'\n' order by id),
          ''
        ),
        'UTF8'
      )),
      'hex'
    ) as content_digest
  from public.product_orders as row_value
),
historical_contract as (
  select pg_catalog.jsonb_build_object(
    'bank_transfer', (select to_jsonb(row_value) from bank_transfer_fingerprint as row_value),
    'payments', (select to_jsonb(row_value) from payments_fingerprint as row_value),
    'product_orders', (select to_jsonb(row_value) from product_orders_fingerprint as row_value)
  ) as value
),
lock_contract as (
  select
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_locks
      where not granted
        and relation = 'public.product_orders'::regclass
    ) as product_orders_blocking,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_locks
      where not granted
        and relation = 'public.payments'::regclass
    ) as payments_blocking,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_stat_activity
      where datname = pg_catalog.current_database()
        and pid <> pg_catalog.pg_backend_pid()
        and xact_start is not null
        and xact_start < pg_catalog.clock_timestamp() - interval '5 seconds'
    ) as long_transactions,
    (select pg_catalog.count(*)::integer from pg_catalog.pg_prepared_xacts) as prepared_transactions,
    (
      select numbackends >= greatest(1, pg_catalog.floor(setting::numeric * 0.8))
      from pg_catalog.pg_stat_database
      cross join pg_catalog.pg_settings
      where datname = pg_catalog.current_database()
        and name = 'max_connections'
    ) as connection_pressure,
    (
      select conflicts::integer
      from pg_catalog.pg_stat_database
      where datname = pg_catalog.current_database()
    ) as conflicts,
    (
      select deadlocks::integer
      from pg_catalog.pg_stat_database
      where datname = pg_catalog.current_database()
    ) as deadlocks
),
migration_history_contract as (
  select
    pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null
      as line_pay_version_present
),
assembled as (
  select
    to_jsonb(database_contract) as database,
    to_jsonb(line_pay_inventory) as line_pay,
    (select value from fence_contract) as fence,
    (select value from historical_contract) as historical,
    to_jsonb(lock_contract) as locks,
    to_jsonb(migration_history_contract) as migration_history
  from database_contract
  cross join line_pay_inventory
  cross join lock_contract
  cross join migration_history_contract
),
classified as (
  select
    case
      when database <> '{"name":"postgres","major":17,"recovery":false}'::jsonb
        then 'SCHEMA_DRIFT'
      when (migration_history ->> 'line_pay_version_present')::boolean
        then 'SCHEMA_DRIFT'
      when (line_pay ->> 'expected_relations_present')::integer = 7
        and (line_pay ->> 'private_schema_present')::boolean
        and (line_pay ->> 'dedicated_roles_present')::integer = 2
        then 'ALREADY_APPLIED'
      when line_pay <> '{
        "expected_relations_present":0,
        "private_schema_present":false,
        "dedicated_roles_present":0,
        "functions_present":0,
        "triggers_present":0,
        "indexes_present":0,
        "policies_present":0,
        "added_columns_present":0,
        "constraints_present":0
      }'::jsonb
        then 'PARTIAL_APPLICATION'
      when fence <> '{
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
        then 'FENCE_REGRESSION'
      when historical <> '{
        "bank_transfer":{
          "rows":3,
          "pending_review":3,
          "pk_digest":"e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec",
          "content_digest":"e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40"
        },
        "payments":{
          "rows":18,
          "pk_digest":"bc3bd47469b3d4c199be57d54c18195f9869d9b1c94527fee445d8cf83f2fa79",
          "content_digest":"da6b440446bde8d5816f06a610baba34140a21dbd9d58e9c8ffbc0867395d1ab"
        },
        "product_orders":{
          "rows":5,
          "pk_digest":"5b2aa41738c901750a2bb752ce23f7e18743631e941476e84a86336e874b55cd",
          "content_digest":"eb133b3808572d8ae76829ba87edc33ae04725609cd1d82e3e1a2db0d502f853"
        }
      }'::jsonb
        then 'PRODUCTION_DATA_DRIFT'
      when locks <> '{
        "product_orders_blocking":0,
        "payments_blocking":0,
        "long_transactions":0,
        "prepared_transactions":0,
        "connection_pressure":false,
        "conflicts":0,
        "deadlocks":0
      }'::jsonb
        then 'BLOCKED_BY_DATABASE_LOCK_RISK'
      else 'READY_EXPECTED'
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
  'locks', locks,
  'migration_history', migration_history
) as audit_result
from classified;
