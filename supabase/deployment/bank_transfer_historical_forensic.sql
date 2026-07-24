BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

select
  exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and relation.relkind = 'r'
  ) as forensic_shape_ready,
  pg_catalog.current_setting('track_commit_timestamp') = 'on'
    as commit_timestamp_tracking_enabled
\gset

\if :forensic_shape_ready
\if :commit_timestamp_tracking_enabled
select pg_catalog.count(*) filter (
  where pg_catalog.pg_xact_commit_timestamp(xmin) is not null
)::integer as rows_with_known_commit_timestamp
from public.bank_transfer_submissions
\gset
\else
\set rows_with_known_commit_timestamp 0
\endif

with
expected_columns(
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
forensic_relation as (
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
actual_columns as (
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
  from forensic_relation as relation
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum > 0
   and not attribute.attisdropped
  left join pg_catalog.pg_attrdef as default_row
    on default_row.adrelid = attribute.attrelid
   and default_row.adnum = attribute.attnum
),
column_contract as (
  select
    (
      select pg_catalog.jsonb_agg(column_name order by column_name)
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(column_name order by column_name)
      from actual_columns
    ) as column_set_match,
    (
      select pg_catalog.jsonb_agg(column_name order by ordinal_position)
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(column_name order by ordinal_position)
      from actual_columns
    ) as column_order_match,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, formatted_type)
        order by ordinal_position
      )
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, formatted_type)
        order by ordinal_position
      )
      from actual_columns
    ) as column_type_match,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, is_not_null)
        order by ordinal_position
      )
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, is_not_null)
        order by ordinal_position
      )
      from actual_columns
    ) as column_nullability_match,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, default_expression)
        order by ordinal_position
      )
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, default_expression)
        order by ordinal_position
      )
      from actual_columns
    ) as column_default_match,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, generated_kind)
        order by ordinal_position
      )
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, generated_kind)
        order by ordinal_position
      )
      from actual_columns
    ) as column_generated_match,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, identity_kind)
        order by ordinal_position
      )
      from expected_columns
    ) = (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(column_name, identity_kind)
        order by ordinal_position
      )
      from actual_columns
    ) as column_identity_match,
    not exists (
      select 1
      from forensic_relation as relation
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
      where attribute.attnum > 0
        and attribute.attisdropped
    ) as no_dropped_columns
),
forensic_policy as (
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
  join forensic_relation as relation on relation.oid = policy.polrelid
),
forensic_acl as (
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
  from forensic_relation as relation
  cross join lateral pg_catalog.aclexplode(relation.effective_acl) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  group by relation.relowner
),
fence_contract as (
  select coalesce(
    (
      select
        relation.relkind = 'r'
        and relation.relrowsecurity
        and (select pg_catalog.count(*) from forensic_policy) = 1
        and (select polname from forensic_policy limit 1)
          = 'Users can read own bank transfer submissions'
        and (select roles from forensic_policy limit 1)
          = '["authenticated"]'::jsonb
        and (select polcmd from forensic_policy limit 1) = 'r'
        and (select using_expression from forensic_policy limit 1)
          = '(( SELECT auth.uid() AS uid) = user_id)'
        and (select with_check_expression from forensic_policy limit 1)
          is null
        and acl.authenticated_acl = '["SELECT"]'::jsonb
        and acl.service_role_acl = '["SELECT"]'::jsonb
        and acl.anon_acl = '[]'::jsonb
        and acl.public_acl = '[]'::jsonb
        and acl.unknown_write_acl_count = 0
        and acl.grant_option_count = 0
      from forensic_relation as relation
      cross join forensic_acl as acl
    ),
    false
  ) as value
),
content_fingerprint as (
  select
    pg_catalog.count(*)::integer as row_count,
    pg_catalog.count(*) filter (
      where to_jsonb(row_value) ->> 'status' = 'pending_review'
    )::integer as pending_review_count,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              to_jsonb(row_value) ->> 'id',
              E'\n' order by to_jsonb(row_value) ->> 'id'
            ),
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
              E'\n' order by to_jsonb(row_value) ->> 'id'
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
table_statistics as (
  select
    pg_catalog.count(*) = 1 as available,
    coalesce(pg_catalog.max(n_tup_ins), 0)::integer as insert_count,
    coalesce(pg_catalog.max(n_tup_upd), 0)::integer as update_count,
    coalesce(pg_catalog.max(n_tup_del), 0)::integer as delete_count
  from pg_catalog.pg_stat_user_tables
  where schemaname = 'public'
    and relname = 'bank_transfer_submissions'
)
select pg_catalog.jsonb_build_object(
  'status',
  'FORENSIC_COMPLETED',
  'database_identity_match',
  (
    pg_catalog.current_database() = 'postgres'
    and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
    and not pg_catalog.pg_is_in_recovery()
  ),
  'fence_match',
  (select value from fence_contract),
  'row_count',
  content_fingerprint.row_count,
  'pk_digest_match',
  content_fingerprint.pk_digest
    = 'e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec',
  'pending_review_count',
  content_fingerprint.pending_review_count,
  'pending_review_match',
  content_fingerprint.pending_review_count = 3,
  'full_content_digest_match',
  content_fingerprint.content_digest
    = 'e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40',
  'schema_signature_match',
  (
    column_contract.column_set_match
    and column_contract.column_order_match
    and column_contract.column_type_match
    and column_contract.column_nullability_match
    and column_contract.column_default_match
    and column_contract.column_generated_match
    and column_contract.column_identity_match
    and column_contract.no_dropped_columns
  ),
  'column_set_match',
  column_contract.column_set_match,
  'column_order_match',
  column_contract.column_order_match,
  'column_type_match',
  column_contract.column_type_match,
  'column_nullability_match',
  column_contract.column_nullability_match,
  'column_default_match',
  column_contract.column_default_match,
  'column_generated_match',
  column_contract.column_generated_match,
  'column_identity_match',
  column_contract.column_identity_match,
  'no_dropped_columns',
  column_contract.no_dropped_columns,
  'commit_timestamp_tracking_enabled',
  :'commit_timestamp_tracking_enabled'::boolean,
  'tuple_commit_timestamp_evidence_available',
  (
    :'commit_timestamp_tracking_enabled'::boolean
    and :'rows_with_known_commit_timestamp'::integer > 0
  ),
  'rows_with_known_commit_timestamp',
  :'rows_with_known_commit_timestamp'::integer,
  'table_stats_available',
  table_statistics.available,
  'table_stats_authoritative',
  false,
  'reported_insert_count',
  table_statistics.insert_count,
  'reported_update_count',
  table_statistics.update_count,
  'reported_delete_count',
  table_statistics.delete_count,
  'baseline_provenance_complete',
  false,
  'exact_changed_row_identifiable',
  false,
  'exact_changed_column_identifiable',
  false,
  'database_audit_log_evidence_status',
  'DATABASE_AUDIT_LOG_EVIDENCE_UNAVAILABLE'
) as forensic_result
from content_fingerprint
cross join column_contract
cross join table_statistics;

\else
select pg_catalog.jsonb_build_object(
  'status',
  'FORENSIC_COMPLETED',
  'database_identity_match',
  (
    pg_catalog.current_database() = 'postgres'
    and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
    and not pg_catalog.pg_is_in_recovery()
  ),
  'fence_match', false,
  'row_count', 0,
  'pk_digest_match', false,
  'pending_review_count', 0,
  'pending_review_match', false,
  'full_content_digest_match', false,
  'schema_signature_match', false,
  'column_set_match', false,
  'column_order_match', false,
  'column_type_match', false,
  'column_nullability_match', false,
  'column_default_match', false,
  'column_generated_match', false,
  'column_identity_match', false,
  'no_dropped_columns', false,
  'commit_timestamp_tracking_enabled',
  :'commit_timestamp_tracking_enabled'::boolean,
  'tuple_commit_timestamp_evidence_available', false,
  'rows_with_known_commit_timestamp', 0,
  'table_stats_available', false,
  'table_stats_authoritative', false,
  'reported_insert_count', 0,
  'reported_update_count', 0,
  'reported_delete_count', 0,
  'baseline_provenance_complete', false,
  'exact_changed_row_identifiable', false,
  'exact_changed_column_identifiable', false,
  'database_audit_log_evidence_status',
  'DATABASE_AUDIT_LOG_EVIDENCE_UNAVAILABLE'
) as forensic_result;
\endif

ROLLBACK;
