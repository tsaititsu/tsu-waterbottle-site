BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

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
capture_relation as (
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
  from capture_relation as relation
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum > 0
   and not attribute.attisdropped
  left join pg_catalog.pg_attrdef as default_row
    on default_row.adrelid = attribute.attrelid
   and default_row.adnum = attribute.attnum
),
schema_contract as (
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
      from expected_columns
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
      from actual_columns
    )
    and not exists (
      select 1
      from capture_relation as relation
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
              from actual_columns
            ),
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as signature
),
capture_policy as (
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
  join capture_relation as relation on relation.oid = policy.polrelid
),
capture_acl as (
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
  from capture_relation as relation
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
        and (select pg_catalog.count(*) from capture_policy) = 1
        and (select polname from capture_policy limit 1)
          = 'Users can read own bank transfer submissions'
        and (select roles from capture_policy limit 1)
          = '["authenticated"]'::jsonb
        and (select polcmd from capture_policy limit 1) = 'r'
        and (select using_expression from capture_policy limit 1)
          = '(( SELECT auth.uid() AS uid) = user_id)'
        and (select with_check_expression from capture_policy limit 1)
          is null
        and acl.authenticated_acl = '["SELECT"]'::jsonb
        and acl.service_role_acl = '["SELECT"]'::jsonb
        and acl.anon_acl = '[]'::jsonb
        and acl.public_acl = '[]'::jsonb
        and acl.unknown_write_acl_count = 0
        and acl.grant_option_count = 0
      from capture_relation as relation
      cross join capture_acl as acl
    ),
    false
  ) as exact
),
canonical_rows as (
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
row_digests as (
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
  from canonical_rows
),
aggregate_digests as (
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
  from canonical_rows as row_value
),
ordinal_contract as (
  select pg_catalog.jsonb_object_agg(
    'ordinal_' || ordinal::text,
    pg_catalog.jsonb_build_object(
      'identity_and_amount', identity_and_amount,
      'payer_contact', payer_contact,
      'transfer_details', transfer_details,
      'review_and_confirmation', review_and_confirmation,
      'full_canonical_row', full_canonical_row
    )
    order by ordinal
  ) as value
  from row_digests
),
capture_contract as (
  select
    (
      pg_catalog.current_database() = 'postgres'
      and pg_catalog.current_setting('server_version_num')::integer / 10000 = 17
      and not pg_catalog.pg_is_in_recovery()
      and (select exact from schema_contract)
      and (select exact from fence_contract)
      and aggregate.row_count = 3
      and aggregate.pending_review_count = 3
      and (select pg_catalog.count(*) from row_digests) = 3
    ) as ready,
    aggregate.*
  from aggregate_digests as aggregate
)
select case
  when capture.ready then pg_catalog.jsonb_build_object(
    'schema_signature', (select signature from schema_contract),
    'group_digests', capture.group_digests,
    'ordinal_digests', (select value from ordinal_contract),
    'row_count', capture.row_count,
    'pk_digest', capture.pk_digest,
    'pending_review_count', capture.pending_review_count
  )
  else pg_catalog.jsonb_build_object(
    'status',
    'BASELINE_CAPTURE_BLOCKED'
  )
end as baseline_capture
from capture_contract as capture;

ROLLBACK;
