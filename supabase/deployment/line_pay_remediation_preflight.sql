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
  from bank_transfer_aggregate_digests as aggregate
  cross join bank_transfer_schema_contract as schema_contract
),
historical_contract as (
  select pg_catalog.jsonb_build_object(
    'bank_transfer', (select value from bank_transfer_contract)
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
\if :{?line_pay_locked_guard}
select
  status as line_pay_locked_guard_status,
  status = 'READY_EXPECTED' as line_pay_locked_guard_ready
from classified
\gset
\else
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
\endif
