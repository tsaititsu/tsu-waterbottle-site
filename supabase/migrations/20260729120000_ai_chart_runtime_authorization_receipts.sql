begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create role ai_chart_runtime_authorization_receipt_owner
  nologin
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

create schema ai_chart_private
  authorization ai_chart_runtime_authorization_receipt_owner;

revoke all privileges on schema ai_chart_private
  from public, anon, authenticated, service_role;

create table ai_chart_private.runtime_activation_authorization_receipts (
  receipt_contract_version text not null,
  receipt_task text not null,
  authorization_status text not null,
  source_contract_version text not null,
  source_contract_fingerprint text not null,
  authorization_port_contract_version text not null,
  authorization_port_contract_fingerprint text not null,
  transport_contract_version text not null,
  transport_contract_fingerprint text not null,
  authorization_command_contract_version text not null,
  authorization_command_task text not null,
  authorization_scope text not null,
  feature text not null,
  release_commit_sha text not null,
  migration_version text not null,
  migration_sha256 text not null,
  migration_readiness_fingerprint text not null,
  runtime_activation_policy_version text not null,
  authorization_command_fingerprint text not null,
  replay_key_fingerprint text not null,
  receipt_fingerprint text not null,
  constraint runtime_authorization_receipts_command_fingerprint_key
    primary key (authorization_command_fingerprint),
  constraint runtime_authorization_receipts_replay_fingerprint_key
    unique (replay_key_fingerprint),
  constraint runtime_authorization_receipts_fixed_values_check
    check (
      receipt_contract_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-contract/v1'
      and receipt_task =
        'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT'
      and authorization_status = 'AUTHORIZED'
      and source_contract_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1'
      and authorization_port_contract_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1'
      and transport_contract_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1'
      and authorization_command_contract_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-command/v1'
      and authorization_command_task =
        'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND'
      and authorization_scope =
        'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE'
      and feature = 'D1_PALACE_WRITING_TRUSTED_DELIVERY'
      and migration_version = '20260728120000'
      and migration_sha256 =
        '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66'
      and runtime_activation_policy_version =
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-policy/v1'
    ),
  constraint runtime_authorization_receipts_release_sha_check
    check (release_commit_sha ~ '^[0-9a-f]{40}$'),
  constraint runtime_authorization_receipts_fingerprints_check
    check (
      source_contract_fingerprint ~ '^[0-9a-f]{64}$'
      and authorization_port_contract_fingerprint ~ '^[0-9a-f]{64}$'
      and transport_contract_fingerprint ~ '^[0-9a-f]{64}$'
      and migration_readiness_fingerprint ~ '^[0-9a-f]{64}$'
      and authorization_command_fingerprint ~ '^[0-9a-f]{64}$'
      and replay_key_fingerprint ~ '^[0-9a-f]{64}$'
      and receipt_fingerprint ~ '^[0-9a-f]{64}$'
    )
);

alter table ai_chart_private.runtime_activation_authorization_receipts
  owner to ai_chart_runtime_authorization_receipt_owner;
alter table ai_chart_private.runtime_activation_authorization_receipts
  enable row level security;
alter table ai_chart_private.runtime_activation_authorization_receipts
  force row level security;

create policy runtime_activation_authorization_receipts_owner_only
  on ai_chart_private.runtime_activation_authorization_receipts
  for all
  to ai_chart_runtime_authorization_receipt_owner
  using (true)
  with check (true);

revoke all privileges on table
  ai_chart_private.runtime_activation_authorization_receipts
  from public, anon, authenticated, service_role;

create function ai_chart_private.reject_runtime_authorization_receipt_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception using
    errcode = 'P0001',
    message = 'ai_chart_runtime_authorization_receipt_immutable';
end;
$function$;

alter function ai_chart_private.reject_runtime_authorization_receipt_mutation()
  owner to ai_chart_runtime_authorization_receipt_owner;
revoke all privileges on function
  ai_chart_private.reject_runtime_authorization_receipt_mutation()
  from public, anon, authenticated, service_role;

create trigger runtime_activation_authorization_receipts_immutable
before update or delete
on ai_chart_private.runtime_activation_authorization_receipts
for each row
execute function ai_chart_private.reject_runtime_authorization_receipt_mutation();

create or replace function public.create_or_read_ai_chart_runtime_authorization_receipt(
  p_receipt_contract_version text,
  p_receipt_task text,
  p_authorization_status text,
  p_source_contract_version text,
  p_source_contract_fingerprint text,
  p_authorization_port_contract_version text,
  p_authorization_port_contract_fingerprint text,
  p_transport_contract_version text,
  p_transport_contract_fingerprint text,
  p_authorization_command_contract_version text,
  p_authorization_command_task text,
  p_authorization_scope text,
  p_feature text,
  p_release_commit_sha text,
  p_migration_version text,
  p_migration_sha256 text,
  p_migration_readiness_fingerprint text,
  p_runtime_activation_policy_version text,
  p_authorization_command_fingerprint text,
  p_replay_key_fingerprint text,
  p_receipt_fingerprint text
)
returns table (
  result_code text,
  receipt_contract_version text,
  receipt_task text,
  authorization_status text,
  source_contract_version text,
  source_contract_fingerprint text,
  authorization_port_contract_version text,
  authorization_port_contract_fingerprint text,
  transport_contract_version text,
  transport_contract_fingerprint text,
  authorization_command_contract_version text,
  authorization_command_task text,
  authorization_scope text,
  feature text,
  release_commit_sha text,
  migration_version text,
  migration_sha256 text,
  migration_readiness_fingerprint text,
  runtime_activation_policy_version text,
  authorization_command_fingerprint text,
  replay_key_fingerprint text,
  receipt_fingerprint text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expected ai_chart_private.runtime_activation_authorization_receipts%rowtype;
  v_existing ai_chart_private.runtime_activation_authorization_receipts%rowtype;
  v_matching_count bigint;
  v_command_lock bigint;
  v_replay_lock bigint;
begin
  if p_receipt_contract_version is null
    or p_receipt_task is null
    or p_authorization_status is null
    or p_source_contract_version is null
    or p_source_contract_fingerprint is null
    or p_authorization_port_contract_version is null
    or p_authorization_port_contract_fingerprint is null
    or p_transport_contract_version is null
    or p_transport_contract_fingerprint is null
    or p_authorization_command_contract_version is null
    or p_authorization_command_task is null
    or p_authorization_scope is null
    or p_feature is null
    or p_release_commit_sha is null
    or p_migration_version is null
    or p_migration_sha256 is null
    or p_migration_readiness_fingerprint is null
    or p_runtime_activation_policy_version is null
    or p_authorization_command_fingerprint is null
    or p_replay_key_fingerprint is null
    or p_receipt_fingerprint is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_invalid_input';
  end if;

  v_expected := row(
    p_receipt_contract_version,
    p_receipt_task,
    p_authorization_status,
    p_source_contract_version,
    p_source_contract_fingerprint,
    p_authorization_port_contract_version,
    p_authorization_port_contract_fingerprint,
    p_transport_contract_version,
    p_transport_contract_fingerprint,
    p_authorization_command_contract_version,
    p_authorization_command_task,
    p_authorization_scope,
    p_feature,
    p_release_commit_sha,
    p_migration_version,
    p_migration_sha256,
    p_migration_readiness_fingerprint,
    p_runtime_activation_policy_version,
    p_authorization_command_fingerprint,
    p_replay_key_fingerprint,
    p_receipt_fingerprint
  );

  v_command_lock := pg_catalog.hashtextextended(
    'ai_chart_runtime_authorization_receipt:command:' ||
      p_authorization_command_fingerprint,
    0
  );
  v_replay_lock := pg_catalog.hashtextextended(
    'ai_chart_runtime_authorization_receipt:replay:' ||
      p_replay_key_fingerprint,
    0
  );
  if v_command_lock <= v_replay_lock then
    perform pg_catalog.pg_advisory_xact_lock(v_command_lock);
    perform pg_catalog.pg_advisory_xact_lock(v_replay_lock);
  else
    perform pg_catalog.pg_advisory_xact_lock(v_replay_lock);
    perform pg_catalog.pg_advisory_xact_lock(v_command_lock);
  end if;

  select pg_catalog.count(*)
  into v_matching_count
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
    or receipt.replay_key_fingerprint = p_replay_key_fingerprint;

  if v_matching_count = 0 then
    insert into ai_chart_private.runtime_activation_authorization_receipts (
      receipt_contract_version,
      receipt_task,
      authorization_status,
      source_contract_version,
      source_contract_fingerprint,
      authorization_port_contract_version,
      authorization_port_contract_fingerprint,
      transport_contract_version,
      transport_contract_fingerprint,
      authorization_command_contract_version,
      authorization_command_task,
      authorization_scope,
      feature,
      release_commit_sha,
      migration_version,
      migration_sha256,
      migration_readiness_fingerprint,
      runtime_activation_policy_version,
      authorization_command_fingerprint,
      replay_key_fingerprint,
      receipt_fingerprint
    ) values (
      p_receipt_contract_version,
      p_receipt_task,
      p_authorization_status,
      p_source_contract_version,
      p_source_contract_fingerprint,
      p_authorization_port_contract_version,
      p_authorization_port_contract_fingerprint,
      p_transport_contract_version,
      p_transport_contract_fingerprint,
      p_authorization_command_contract_version,
      p_authorization_command_task,
      p_authorization_scope,
      p_feature,
      p_release_commit_sha,
      p_migration_version,
      p_migration_sha256,
      p_migration_readiness_fingerprint,
      p_runtime_activation_policy_version,
      p_authorization_command_fingerprint,
      p_replay_key_fingerprint,
      p_receipt_fingerprint
    );

    return query
    select
      'CREATED'::text,
      receipt.*
    from ai_chart_private.runtime_activation_authorization_receipts as receipt
    where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint;
    return;
  end if;

  if v_matching_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_conflict';
  end if;

  select receipt.*
  into strict v_existing
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
    or receipt.replay_key_fingerprint = p_replay_key_fingerprint;

  if v_existing is distinct from v_expected then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_conflict';
  end if;

  return query
  select
    'EXISTING_EXACT'::text,
    receipt.*
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
    p_authorization_command_fingerprint;
exception
  when unique_violation then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_conflict';
end;
$function$;

alter function public.create_or_read_ai_chart_runtime_authorization_receipt(
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text
) owner to ai_chart_runtime_authorization_receipt_owner;
revoke all privileges on function
  public.create_or_read_ai_chart_runtime_authorization_receipt(
    text, text, text, text, text, text, text,
    text, text, text, text, text, text, text,
    text, text, text, text, text, text, text
  )
  from public, anon, authenticated, service_role;
grant execute on function
  public.create_or_read_ai_chart_runtime_authorization_receipt(
    text, text, text, text, text, text, text,
    text, text, text, text, text, text, text,
    text, text, text, text, text, text, text
  )
  to service_role;

create or replace function public.reconcile_ai_chart_runtime_authorization_receipt(
  p_authorization_command_fingerprint text,
  p_replay_key_fingerprint text
)
returns table (
  result_code text,
  receipt_contract_version text,
  receipt_task text,
  authorization_status text,
  source_contract_version text,
  source_contract_fingerprint text,
  authorization_port_contract_version text,
  authorization_port_contract_fingerprint text,
  transport_contract_version text,
  transport_contract_fingerprint text,
  authorization_command_contract_version text,
  authorization_command_task text,
  authorization_scope text,
  feature text,
  release_commit_sha text,
  migration_version text,
  migration_sha256 text,
  migration_readiness_fingerprint text,
  runtime_activation_policy_version text,
  authorization_command_fingerprint text,
  replay_key_fingerprint text,
  receipt_fingerprint text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing ai_chart_private.runtime_activation_authorization_receipts%rowtype;
  v_matching_count bigint;
begin
  select pg_catalog.count(*)
  into v_matching_count
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
    or receipt.replay_key_fingerprint = p_replay_key_fingerprint;

  if v_matching_count = 0 then
    raise exception using
      errcode = 'P0001',
      message =
        'ai_chart_runtime_authorization_receipt_reconciliation_required';
  end if;

  if v_matching_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_conflict';
  end if;

  select receipt.*
  into strict v_existing
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
    or receipt.replay_key_fingerprint = p_replay_key_fingerprint;

  if v_existing.authorization_command_fingerprint <>
      p_authorization_command_fingerprint
    or v_existing.replay_key_fingerprint <> p_replay_key_fingerprint
  then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_conflict';
  end if;

  return query
  select
    'RECONCILED_EXACT'::text,
    receipt.*
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
    and receipt.replay_key_fingerprint = p_replay_key_fingerprint;
end;
$function$;

alter function public.reconcile_ai_chart_runtime_authorization_receipt(
  text, text
) owner to ai_chart_runtime_authorization_receipt_owner;
revoke all privileges on function
  public.reconcile_ai_chart_runtime_authorization_receipt(text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.reconcile_ai_chart_runtime_authorization_receipt(text, text)
  to service_role;

create or replace function public.read_ai_chart_runtime_authorization_receipt(
  p_authorization_command_fingerprint text
)
returns table (
  result_code text,
  receipt_contract_version text,
  receipt_task text,
  authorization_status text,
  source_contract_version text,
  source_contract_fingerprint text,
  authorization_port_contract_version text,
  authorization_port_contract_fingerprint text,
  transport_contract_version text,
  transport_contract_fingerprint text,
  authorization_command_contract_version text,
  authorization_command_task text,
  authorization_scope text,
  feature text,
  release_commit_sha text,
  migration_version text,
  migration_sha256 text,
  migration_readiness_fingerprint text,
  runtime_activation_policy_version text,
  authorization_command_fingerprint text,
  replay_key_fingerprint text,
  receipt_fingerprint text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from ai_chart_private.runtime_activation_authorization_receipts as receipt
    where receipt.authorization_command_fingerprint =
      p_authorization_command_fingerprint
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ai_chart_runtime_authorization_receipt_not_found';
  end if;

  return query
  select
    'READ_EXACT'::text,
    receipt.*
  from ai_chart_private.runtime_activation_authorization_receipts as receipt
  where receipt.authorization_command_fingerprint =
    p_authorization_command_fingerprint;
end;
$function$;

alter function public.read_ai_chart_runtime_authorization_receipt(text)
  owner to ai_chart_runtime_authorization_receipt_owner;
revoke all privileges on function
  public.read_ai_chart_runtime_authorization_receipt(text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.read_ai_chart_runtime_authorization_receipt(text)
  to service_role;

commit;
