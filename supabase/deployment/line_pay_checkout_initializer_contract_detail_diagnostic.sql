\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

select (
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
  and pg_catalog.to_regrole('anon') is not null
  and pg_catalog.to_regrole('authenticated') is not null
) as line_pay_initializer_base_ready
\gset

\if :line_pay_initializer_base_ready

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
      cross join lateral pg_catalog.aclexplode(relation.relacl) as table_acl
      where namespace.nspname = 'public'
        and relation.relname in (
          'product_order_items',
          'product_shipping_info'
        )
        and table_acl.grantee =
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        and table_acl.privilege_type = 'SELECT'
        and not table_acl.is_grantable
        and table_acl.grantor = relation.relowner
    ) as table_select_grants_present
),
initializer_function as (
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
    ) as signature_exact,
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
    ) as security_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      join pg_catalog.pg_roles as owner
        on owner.oid = procedure.proowner
      where namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
        and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb'
        and owner.rolname = current_user
    ) as owner_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
        and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb'
        and pg_catalog.obj_description(procedure.oid, 'pg_proc')
          = 'line_pay_definition_md5:01f23508c326066dd4c7ef214c27b60e'
        and pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
          = '01f23508c326066dd4c7ef214c27b60e'
    ) as definition_exact,
    (
      select
        pg_catalog.count(*) = 2
        and pg_catalog.count(*) filter (
          where function_acl.grantee = procedure.proowner
            and function_acl.grantor = procedure.proowner
            and not function_acl.is_grantable
        ) = 1
        and pg_catalog.count(*) filter (
          where function_acl.grantee =
              pg_catalog.to_regrole('service_role')::oid
            and function_acl.grantor = procedure.proowner
            and not function_acl.is_grantable
        ) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) as function_acl
      where namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
        and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb'
        and function_acl.privilege_type = 'EXECUTE'
    ) as execute_acl_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
        and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb'
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
    ) as runtime_execute_exact
),
audit_function as (
  select
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
    ) as signature_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
        and procedure.prosecdef
        and procedure.provolatile = 'v'
        and 'search_path=""' = any (procedure.proconfig)
    ) as security_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      join pg_catalog.pg_roles as owner
        on owner.oid = procedure.proowner
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
        and owner.rolname = 'line_pay_payment_function_owner'
    ) as owner_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
        and pg_catalog.obj_description(procedure.oid, 'pg_proc')
          = 'line_pay_definition_md5:58527777d0bd2138231218673699b634'
        and pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
          = '58527777d0bd2138231218673699b634'
    ) as definition_exact,
    (
      select
        pg_catalog.count(*) = 2
        and pg_catalog.count(*) filter (
          where function_acl.grantee = procedure.proowner
            and function_acl.grantor = procedure.proowner
            and not function_acl.is_grantable
        ) = 1
        and pg_catalog.count(*) filter (
          where function_acl.grantee =
              pg_catalog.to_regrole('service_role')::oid
            and function_acl.grantor = procedure.proowner
            and not function_acl.is_grantable
        ) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) as function_acl
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
        and function_acl.privilege_type = 'EXECUTE'
    ) as execute_acl_exact,
    (
      select pg_catalog.count(*) = 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
        and pg_catalog.oidvectortypes(procedure.proargtypes)
          = 'uuid, uuid, uuid, text'
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
    ) as runtime_execute_exact
),
index_contract as (
  select (
    select pg_catalog.count(*) = 1
    from pg_catalog.pg_index as index_catalog
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_catalog.indexrelid
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = index_catalog.indrelid
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_relation.relnamespace
    join pg_catalog.pg_am as access_method
      on access_method.oid = index_relation.relam
    join pg_catalog.pg_attribute as key_attribute
      on key_attribute.attrelid = table_relation.oid
     and key_attribute.attname = 'checkout_attempt_id'
     and key_attribute.attnum > 0
     and not key_attribute.attisdropped
    where index_namespace.nspname = 'public'
      and index_relation.relname =
        'line_pay_payment_audit_events_checkout_initialized_once_idx'
      and table_namespace.nspname = 'public'
      and table_relation.relname = 'line_pay_payment_audit_events'
      and access_method.amname = 'btree'
      and index_catalog.indisunique
      and index_catalog.indisvalid
      and index_catalog.indisready
      and index_catalog.indnkeyatts = 1
      and index_catalog.indnatts = 1
      and not index_catalog.indnullsnotdistinct
      and index_catalog.indexprs is null
      and index_catalog.indkey[0] = key_attribute.attnum
      and pg_catalog.pg_get_indexdef(index_catalog.indexrelid)
        ~ '\(checkout_attempt_id\)'
      and pg_catalog.pg_get_expr(
        index_catalog.indpred,
        index_catalog.indrelid
      ) = '(event_type = ''checkout_initialized''::text)'
  ) as exact
),
policy_contract as (
  select
    (
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
    ) as audit_insert_exact,
    (
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
    ) as items_select_exact,
    (
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
    ) as shipping_select_exact
),
table_acl_contract as (
  select
    pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_order_items',
      'select'
    ) as items_select_exact,
    pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_shipping_info',
      'select'
    ) as shipping_select_exact,
    not pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_order_items',
      'insert,update,delete,truncate,references,trigger'
    ) as no_items_write,
    not pg_catalog.has_table_privilege(
      'line_pay_payment_function_owner',
      'public.product_shipping_info',
      'insert,update,delete,truncate,references,trigger'
    ) as no_shipping_write,
    (
      select pg_catalog.count(*) = 2
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as table_acl
      where namespace.nspname = 'public'
        and relation.relname in (
          'product_order_items',
          'product_shipping_info'
        )
        and table_acl.grantee =
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        and table_acl.privilege_type = 'SELECT'
        and not table_acl.is_grantable
        and table_acl.grantor = relation.relowner
    ) as aggregate_select_acl_exact,
    not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as table_acl
      where namespace.nspname = 'public'
        and relation.relname in (
          'product_order_items',
          'product_shipping_info'
        )
        and (
          (
            table_acl.grantee =
              pg_catalog.to_regrole(
                'line_pay_payment_function_owner'
              )::oid
            and (
              table_acl.privilege_type <> 'SELECT'
              or table_acl.is_grantable
              or table_acl.grantor <> relation.relowner
            )
          )
          or (
            table_acl.grantor =
              pg_catalog.to_regrole(
                'line_pay_payment_function_owner'
              )::oid
            and table_acl.grantee <> table_acl.grantor
          )
        )
    ) as no_role_issued_acl,
    (
      select
        pg_catalog.count(*) = 2
        and pg_catalog.count(*) filter (
          where table_acl.grantee =
              pg_catalog.to_regrole(
                'line_pay_payment_function_owner'
              )::oid
            and table_acl.privilege_type = 'SELECT'
            and table_acl.grantor = relation.relowner
            and not table_acl.is_grantable
        ) = 1
        and pg_catalog.count(*) filter (
          where table_acl.grantee =
              pg_catalog.to_regrole(
                'line_pay_payment_function_owner'
              )::oid
            and table_acl.privilege_type = 'INSERT'
            and table_acl.grantor = relation.relowner
            and not table_acl.is_grantable
        ) = 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          relation.relacl,
          pg_catalog.acldefault('r', relation.relowner)
        )
      ) as table_acl
      where namespace.nspname = 'public'
        and relation.relname = 'line_pay_payment_audit_events'
        and table_acl.grantee <> relation.relowner
    ) as audit_table_acl_exact,
    not pg_catalog.has_table_privilege(
      'service_role',
      'public.line_pay_payment_audit_events',
      'select,insert,update,delete,truncate,references,trigger'
    ) as service_role_audit_access_absent
),
role_contract as (
  select not exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role
      on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role
      on member_role.oid = membership.member
    where granted_role.rolname = 'line_pay_payment_function_owner'
      or member_role.rolname = 'line_pay_payment_function_owner'
  ) as function_owner_membership_absent
),
contract as (
  select
    inventory.functions_present = 2
    and inventory.indexes_present = 1
    and inventory.policies_present = 3
    and inventory.table_select_grants_present = 2
    and initializer_function.signature_exact
    and initializer_function.security_exact
    and initializer_function.owner_exact
    and initializer_function.definition_exact
    and initializer_function.execute_acl_exact
    and initializer_function.runtime_execute_exact
    and audit_function.signature_exact
    and audit_function.security_exact
    and audit_function.owner_exact
    and audit_function.definition_exact
    and audit_function.execute_acl_exact
    and audit_function.runtime_execute_exact
    and index_contract.exact
    and policy_contract.audit_insert_exact
    and policy_contract.items_select_exact
    and policy_contract.shipping_select_exact
    and table_acl_contract.items_select_exact
    and table_acl_contract.shipping_select_exact
    and table_acl_contract.no_items_write
    and table_acl_contract.no_shipping_write
    and table_acl_contract.aggregate_select_acl_exact
    and table_acl_contract.no_role_issued_acl
    and table_acl_contract.audit_table_acl_exact
    and table_acl_contract.service_role_audit_access_absent
    and role_contract.function_owner_membership_absent
      as initializer_exact
  from inventory,
    initializer_function,
    audit_function,
    index_contract,
    policy_contract,
    table_acl_contract,
    role_contract
)
select pg_catalog.jsonb_build_object(
  'status',
    'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    pg_catalog.current_database() = 'postgres'
    and not pg_catalog.pg_is_in_recovery(),
  'base_remediation_ready', true,
  'inventory', pg_catalog.to_jsonb(inventory),
  'initializer_function', pg_catalog.to_jsonb(initializer_function),
  'audit_function', pg_catalog.to_jsonb(audit_function),
  'index_contract', pg_catalog.to_jsonb(index_contract),
  'policy_contract', pg_catalog.to_jsonb(policy_contract),
  'table_acl_contract', pg_catalog.to_jsonb(table_acl_contract),
  'role_contract', pg_catalog.to_jsonb(role_contract),
  'decision', pg_catalog.jsonb_build_object(
    'initializer_exact', contract.initializer_exact,
    'recovery_required', not contract.initializer_exact,
    'detail_complete', true
  )
)::text
from inventory,
  initializer_function,
  audit_function,
  index_contract,
  policy_contract,
  table_acl_contract,
  role_contract,
  contract;

\else

select pg_catalog.jsonb_build_object(
  'status',
    'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    pg_catalog.current_database() = 'postgres'
    and not pg_catalog.pg_is_in_recovery(),
  'base_remediation_ready', false,
  'inventory', pg_catalog.jsonb_build_object(
    'functions_present', 0,
    'indexes_present', 0,
    'policies_present', 0,
    'table_select_grants_present', 0
  ),
  'initializer_function', pg_catalog.jsonb_build_object(
    'signature_exact', false,
    'security_exact', false,
    'owner_exact', false,
    'definition_exact', false,
    'execute_acl_exact', false,
    'runtime_execute_exact', false
  ),
  'audit_function', pg_catalog.jsonb_build_object(
    'signature_exact', false,
    'security_exact', false,
    'owner_exact', false,
    'definition_exact', false,
    'execute_acl_exact', false,
    'runtime_execute_exact', false
  ),
  'index_contract', pg_catalog.jsonb_build_object(
    'exact', false
  ),
  'policy_contract', pg_catalog.jsonb_build_object(
    'audit_insert_exact', false,
    'items_select_exact', false,
    'shipping_select_exact', false
  ),
  'table_acl_contract', pg_catalog.jsonb_build_object(
    'items_select_exact', false,
    'shipping_select_exact', false,
    'no_items_write', false,
    'no_shipping_write', false,
    'aggregate_select_acl_exact', false,
    'no_role_issued_acl', false,
    'audit_table_acl_exact', false,
    'service_role_audit_access_absent', false
  ),
  'role_contract', pg_catalog.jsonb_build_object(
    'function_owner_membership_absent', false
  ),
  'decision', pg_catalog.jsonb_build_object(
    'initializer_exact', false,
    'recovery_required', false,
    'detail_complete', false
  )
)::text;

\endif

ROLLBACK;
