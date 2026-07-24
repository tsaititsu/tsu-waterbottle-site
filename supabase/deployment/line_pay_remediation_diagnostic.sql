BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

select
  exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'supabase_migrations'
      and relation.relname = 'schema_migrations'
      and relation.relkind in ('r', 'p')
      and exists (
        select 1
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = relation.oid
          and attribute.attname = 'version'
          and attribute.attnum > 0
          and not attribute.attisdropped
      )
  ) as migration_history_ready,
  (
    (
      select pg_catalog.count(*)
      from (
        values
          ('public', 'bank_transfer_submissions'),
          ('public', 'payments'),
          ('public', 'product_orders')
      ) as expected(schema_name, relation_name)
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
       and relation.relkind in ('r', 'p')
    ) = 3
    and (
      select pg_catalog.count(*)
      from (
        values
          ('bank_transfer_submissions', 'id'),
          ('bank_transfer_submissions', 'status'),
          ('payments', 'id'),
          ('payments', 'updated_at'),
          ('product_orders', 'id')
      ) as expected(relation_name, column_name)
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = 'public'
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
       and relation.relkind in ('r', 'p')
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
       and attribute.attname = expected.column_name
       and attribute.attnum > 0
       and not attribute.attisdropped
    ) = 5
  ) as diagnostic_shape_ready
\gset

\if :migration_history_ready
select not exists (
  select 1
  from supabase_migrations.schema_migrations
  where version = '20260719033404'
) as migration_history_absent
\gset
\else
\set migration_history_absent true
\endif

\if :diagnostic_shape_ready
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
      select pg_catalog.count(*)
      from expected_relations as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.relation_name
       and relation.relkind in ('r', 'p')
    ) = 0
    and not exists (
      select 1
      from pg_catalog.pg_namespace
      where nspname = 'line_pay_private'
    )
    and (
      select pg_catalog.count(*)
      from pg_catalog.pg_roles
      where rolname in (
        'line_pay_payment_executor',
        'line_pay_payment_function_owner'
      )
    ) = 0
    and (
      select pg_catalog.count(*)
      from expected_functions as expected
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = expected.schema_name
      join pg_catalog.pg_proc as procedure
        on procedure.pronamespace = namespace.oid
       and procedure.proname = expected.function_name
    ) = 0
    and (
      select pg_catalog.count(*)
      from pg_catalog.pg_trigger
      where not tgisinternal
        and tgname like 'line_pay_%'
    ) = 0
    and (
      select pg_catalog.count(*)
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
    ) = 0
    and (
      select pg_catalog.count(*)
      from pg_catalog.pg_policy
      where polname like 'line_pay_payment_function_owner_%'
    ) = 0
    and (
      select pg_catalog.count(*)
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
    ) = 0
    and (
      select pg_catalog.count(*)
      from expected_line_pay_constraints as expected
      join pg_catalog.pg_constraint as constraint_row
        on constraint_row.conname = expected.constraint_name
    ) = 0 as value
),
fence_relation as (
  select
    relation.oid,
    relation.relkind,
    relation.relrowsecurity,
    relation.relowner,
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
    pg_catalog.pg_get_expr(
      policy.polqual,
      policy.polrelid,
      false
    ) as using_expression,
    pg_catalog.pg_get_expr(
      policy.polwithcheck,
      policy.polrelid,
      false
    ) as with_check_expression
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
          'anon',
          'authenticated',
          'service_role'
        )
        and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    )::integer as unknown_write_acl_count,
    pg_catalog.count(*) filter (
      where acl.grantee <> relation.relowner
        and acl.is_grantable
    )::integer as grant_option_count
  from fence_relation as relation
  cross join lateral pg_catalog.aclexplode(relation.effective_acl) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  group by relation.relowner
),
fence_match as (
  select coalesce(
    (
      select
        relation.relkind = 'r'
        and relation.relrowsecurity
        and (select pg_catalog.count(*) from fence_policy) = 1
        and (select polname from fence_policy limit 1)
          = 'Users can read own bank transfer submissions'
        and (select roles from fence_policy limit 1)
          = '["authenticated"]'::jsonb
        and (select polcmd from fence_policy limit 1) = 'r'
        and (select using_expression from fence_policy limit 1)
          = '(( SELECT auth.uid() AS uid) = user_id)'
        and (select with_check_expression from fence_policy limit 1) is null
        and acl.authenticated_acl = '["SELECT"]'::jsonb
        and acl.service_role_acl = '["SELECT"]'::jsonb
        and acl.anon_acl = '[]'::jsonb
        and acl.public_acl = '[]'::jsonb
        and acl.unknown_write_acl_count = 0
        and acl.grant_option_count = 0
      from fence_relation as relation
      cross join fence_acl as acl
    ),
    false
  ) as value
),
bank_transfer_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.count(*) filter (
      where status = 'pending_review'
    )::integer as pending_review,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(id::text, E'\n' order by id),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              to_jsonb(row_value)::text,
              E'\n' order by id
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as content_digest
  from public.bank_transfer_submissions as row_value
),
payments_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(id::text, E'\n' order by id),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              (to_jsonb(row_value) - 'updated_at')::text,
              E'\n' order by id
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as content_digest
  from public.payments as row_value
),
product_orders_fingerprint as (
  select
    pg_catalog.count(*)::integer as rows,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(id::text, E'\n' order by id),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as pk_digest,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              to_jsonb(row_value)::text,
              E'\n' order by id
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as content_digest
  from public.product_orders as row_value
)
select pg_catalog.jsonb_build_object(
  'status',
  'DIAGNOSTIC_COMPLETED',
  'database_identity_match',
  (
    pg_catalog.current_database() = 'postgres'
    and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
    and not pg_catalog.pg_is_in_recovery()
  ),
  'line_pay_unapplied',
  (select value from line_pay_inventory),
  'migration_history_absent',
  :'migration_history_absent'::boolean,
  'fence_match',
  (select value from fence_match),
  'datasets',
  pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'dataset',
      'bank_transfer',
      'expected_rows',
      3,
      'actual_rows',
      bank_transfer_fingerprint.rows,
      'rows_match',
      bank_transfer_fingerprint.rows = 3,
      'pk_digest_match',
      bank_transfer_fingerprint.pk_digest
        = 'e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec',
      'content_digest_match',
      bank_transfer_fingerprint.content_digest
        = 'e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40',
      'expected_pending_review',
      3,
      'actual_pending_review',
      bank_transfer_fingerprint.pending_review,
      'pending_review_match',
      bank_transfer_fingerprint.pending_review = 3
    ),
    pg_catalog.jsonb_build_object(
      'dataset',
      'payments',
      'expected_rows',
      18,
      'actual_rows',
      payments_fingerprint.rows,
      'rows_match',
      payments_fingerprint.rows = 18,
      'pk_digest_match',
      payments_fingerprint.pk_digest
        = 'bc3bd47469b3d4c199be57d54c18195f9869d9b1c94527fee445d8cf83f2fa79',
      'content_digest_match',
      payments_fingerprint.content_digest
        = 'da6b440446bde8d5816f06a610baba34140a21dbd9d58e9c8ffbc0867395d1ab'
    ),
    pg_catalog.jsonb_build_object(
      'dataset',
      'product_orders',
      'expected_rows',
      5,
      'actual_rows',
      product_orders_fingerprint.rows,
      'rows_match',
      product_orders_fingerprint.rows = 5,
      'pk_digest_match',
      product_orders_fingerprint.pk_digest
        = '5b2aa41738c901750a2bb752ce23f7e18743631e941476e84a86336e874b55cd',
      'content_digest_match',
      product_orders_fingerprint.content_digest
        = 'eb133b3808572d8ae76829ba87edc33ae04725609cd1d82e3e1a2db0d502f853'
    )
  )
) as diagnostic_result
from bank_transfer_fingerprint
cross join payments_fingerprint
cross join product_orders_fingerprint;

\else
select pg_catalog.jsonb_build_object(
  'status',
  'DIAGNOSTIC_COMPLETED',
  'database_identity_match',
  (
    pg_catalog.current_database() = 'postgres'
    and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
    and not pg_catalog.pg_is_in_recovery()
  ),
  'line_pay_unapplied',
  false,
  'migration_history_absent',
  :'migration_history_absent'::boolean,
  'fence_match',
  false,
  'datasets',
  pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'dataset',
      'bank_transfer',
      'expected_rows',
      3,
      'actual_rows',
      0,
      'rows_match',
      false,
      'pk_digest_match',
      false,
      'content_digest_match',
      false,
      'expected_pending_review',
      3,
      'actual_pending_review',
      0,
      'pending_review_match',
      false
    ),
    pg_catalog.jsonb_build_object(
      'dataset',
      'payments',
      'expected_rows',
      18,
      'actual_rows',
      0,
      'rows_match',
      false,
      'pk_digest_match',
      false,
      'content_digest_match',
      false
    ),
    pg_catalog.jsonb_build_object(
      'dataset',
      'product_orders',
      'expected_rows',
      5,
      'actual_rows',
      0,
      'rows_match',
      false,
      'pk_digest_match',
      false,
      'content_digest_match',
      false
    )
  )
) as diagnostic_result;
\endif

ROLLBACK;
