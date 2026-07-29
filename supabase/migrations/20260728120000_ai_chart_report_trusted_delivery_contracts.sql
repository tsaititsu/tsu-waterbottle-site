begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.ai_chart_reports
add column if not exists chart_snapshot_sha256 text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname =
      'ai_chart_reports_chart_snapshot_sha256_check'
      and conrelid = 'public.ai_chart_reports'::regclass
  ) then
    alter table public.ai_chart_reports
    add constraint ai_chart_reports_chart_snapshot_sha256_check
    check (
      chart_snapshot_sha256 is null
      or chart_snapshot_sha256 ~ '^[0-9a-f]{64}$'
    );
  end if;
end
$$;

create table public.ai_chart_report_review_ledger (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.ai_chart_reports(id) on delete restrict,
  reviewer_id uuid not null,
  decision text not null
    check (decision in ('APPROVED', 'REPAIR_REQUIRED', 'REJECTED')),
  record_payload jsonb not null
    check (jsonb_typeof(record_payload) = 'object'),
  record_payload_sha256 text not null
    check (record_payload_sha256 ~ '^[0-9a-f]{64}$'),
  record_fingerprint text not null
    check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  envelope_fingerprint text not null
    check (envelope_fingerprint ~ '^[0-9a-f]{64}$'),
  report_snapshot_sha256 text not null
    check (report_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  gate_fingerprint text not null
    check (gate_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_payload_sha256 text not null
    check (artifact_payload_sha256 ~ '^[0-9a-f]{64}$'),
  ledger_receipt_fingerprint text not null
    check (ledger_receipt_fingerprint ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (report_id, gate_fingerprint),
  unique (record_fingerprint),
  unique (ledger_receipt_fingerprint)
);

comment on table public.ai_chart_report_review_ledger is
  'Append-only safe metadata for source-bound AI chart human review records.';

create table public.ai_chart_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique
    references public.ai_chart_reports(id) on delete restrict,
  review_ledger_id uuid not null
    references public.ai_chart_report_review_ledger(id) on delete restrict,
  idempotency_key text not null unique
    check (idempotency_key ~ '^[0-9a-f]{64}$'),
  contract_fingerprint text not null
    check (contract_fingerprint ~ '^[0-9a-f]{64}$'),
  source_coordination_fingerprint text not null
    check (source_coordination_fingerprint ~ '^[0-9a-f]{64}$'),
  report_snapshot_sha256 text not null
    check (report_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  gate_fingerprint text not null
    check (gate_fingerprint ~ '^[0-9a-f]{64}$'),
  record_fingerprint text not null
    check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  record_payload_sha256 text not null
    check (record_payload_sha256 ~ '^[0-9a-f]{64}$'),
  envelope_fingerprint text not null
    check (envelope_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_payload_sha256 text not null
    check (artifact_payload_sha256 ~ '^[0-9a-f]{64}$'),
  report_content_sha256 text not null
    check (report_content_sha256 ~ '^[0-9a-f]{64}$'),
  delivery_claim_fingerprint text not null unique
    check (delivery_claim_fingerprint ~ '^[0-9a-f]{64}$'),
  delivery_receipt_fingerprint text not null unique
    check (delivery_receipt_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'published'
    check (status = 'published'),
  claimed_at timestamptz not null,
  published_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);

comment on table public.ai_chart_report_deliveries is
  'Immutable safe receipts for one source-bound AI chart Report publication.';

create or replace function public.prevent_ai_chart_report_delivery_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ai_chart_report_delivery_audit_immutable';
end;
$$;

create trigger prevent_ai_chart_report_review_ledger_mutation
before update or delete on public.ai_chart_report_review_ledger
for each row
execute function public.prevent_ai_chart_report_delivery_audit_mutation();

create trigger prevent_ai_chart_report_deliveries_mutation
before update or delete on public.ai_chart_report_deliveries
for each row
execute function public.prevent_ai_chart_report_delivery_audit_mutation();

alter table public.ai_chart_report_review_ledger
enable row level security;

alter table public.ai_chart_report_deliveries
enable row level security;

revoke all privileges
on table public.ai_chart_report_review_ledger
from public, anon, authenticated, service_role;

revoke all privileges
on table public.ai_chart_report_deliveries
from public, anon, authenticated, service_role;

revoke execute
on function public.prevent_ai_chart_report_delivery_audit_mutation()
from public, anon, authenticated, service_role;

create or replace function public.deliver_ai_chart_report_after_review(
  p_report_id uuid,
  p_expected_owner_user_id uuid,
  p_review_record text,
  p_report_snapshot_sha256 text,
  p_gate_fingerprint text,
  p_record_fingerprint text,
  p_record_payload_sha256 text,
  p_envelope_fingerprint text,
  p_contract_fingerprint text,
  p_source_coordination_fingerprint text,
  p_idempotency_key text,
  p_artifact_payload_sha256 text,
  p_ledger_receipt_fingerprint text,
  p_delivery_claim_fingerprint text,
  p_delivery_receipt_fingerprint text,
  p_report_content_sha256 text,
  p_report_content text
)
returns table (
  result_code text,
  ledger_receipt_fingerprint text,
  delivery_claim_fingerprint text,
  delivery_receipt_fingerprint text,
  report_content_sha256 text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.ai_chart_reports%rowtype;
  v_ledger public.ai_chart_report_review_ledger%rowtype;
  v_delivery public.ai_chart_report_deliveries%rowtype;
  v_reviewer_id uuid;
  v_recorded_at timestamptz;
  v_review_record jsonb;
  v_review_record_key_count bigint := 0;
  v_review_record_keys_allowed boolean := false;
  v_actual_record_payload_sha256 text;
  v_actual_report_content_sha256 text;
  v_expected_review_record_keys constant text[] := array[
    'artifactPayloadSha256',
    'artifactSourceSnapshotSha256',
    'authorizationFingerprint',
    'authorizationStatus',
    'contractVersion',
    'customerDeliveryStatus',
    'dataClassification',
    'decision',
    'gateFingerprint',
    'issueCodes',
    'permission',
    'proposalFingerprint',
    'recordFingerprint',
    'recordedAt',
    'recordedAtAuthority',
    'reportId',
    'reportSnapshotSha256',
    'restrictedArtifactFingerprint',
    'reviewCommandFingerprint',
    'reviewerId',
    'sourceBindingFingerprint',
    'sourceBindingStatus',
    'task'
  ]::text[];
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_updated_rows integer := 0;
begin
  if p_report_id is null
     or p_expected_owner_user_id is null
     or p_review_record is null
     or pg_catalog.octet_length(p_review_record) > 32768
     or p_report_snapshot_sha256 !~ '^[0-9a-f]{64}$'
     or p_gate_fingerprint !~ '^[0-9a-f]{64}$'
     or p_record_fingerprint !~ '^[0-9a-f]{64}$'
     or p_record_payload_sha256 !~ '^[0-9a-f]{64}$'
     or p_envelope_fingerprint !~ '^[0-9a-f]{64}$'
     or p_contract_fingerprint !~ '^[0-9a-f]{64}$'
     or p_source_coordination_fingerprint !~ '^[0-9a-f]{64}$'
     or p_idempotency_key !~ '^[0-9a-f]{64}$'
     or p_artifact_payload_sha256 !~ '^[0-9a-f]{64}$'
     or p_ledger_receipt_fingerprint !~ '^[0-9a-f]{64}$'
     or p_delivery_claim_fingerprint !~ '^[0-9a-f]{64}$'
     or p_delivery_receipt_fingerprint !~ '^[0-9a-f]{64}$'
     or p_report_content_sha256 !~ '^[0-9a-f]{64}$'
     or p_report_content is null
     or pg_catalog.btrim(p_report_content) = '' then
    raise exception using
      errcode = '22023',
      message = 'ai_chart_report_delivery_invalid_input';
  end if;

  begin
    v_review_record := p_review_record::jsonb;
  exception
    when invalid_text_representation then
      raise exception using
        errcode = '22023',
        message = 'ai_chart_report_delivery_review_record_invalid';
  end;

  if jsonb_typeof(v_review_record) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'ai_chart_report_delivery_review_record_invalid';
  end if;

  if pg_catalog.to_regprocedure(
    'extensions.digest(bytea,text)'
  ) is not null then
    execute $hash$
      select
        pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to($1, 'UTF8'),
            'sha256'
          ),
          'hex'
        ),
        pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to($2, 'UTF8'),
            'sha256'
          ),
          'hex'
        )
    $hash$
    into
      v_actual_record_payload_sha256,
      v_actual_report_content_sha256
    using p_review_record, p_report_content;
  elsif pg_catalog.to_regprocedure(
    'public.digest(bytea,text)'
  ) is not null then
    execute $hash$
      select
        pg_catalog.encode(
          public.digest(
            pg_catalog.convert_to($1, 'UTF8'),
            'sha256'
          ),
          'hex'
        ),
        pg_catalog.encode(
          public.digest(
            pg_catalog.convert_to($2, 'UTF8'),
            'sha256'
          ),
          'hex'
        )
    $hash$
    into
      v_actual_record_payload_sha256,
      v_actual_report_content_sha256
    using p_review_record, p_report_content;
  else
    raise exception using
      errcode = '55000',
      message = 'ai_chart_report_delivery_sha256_unavailable';
  end if;

  if v_actual_record_payload_sha256
       is distinct from p_record_payload_sha256 then
    raise exception using
      errcode = '22023',
      message =
        'ai_chart_report_delivery_review_record_hash_mismatch';
  end if;

  if v_actual_report_content_sha256
       is distinct from p_report_content_sha256 then
    raise exception using
      errcode = '22023',
      message = 'ai_chart_report_delivery_content_hash_mismatch';
  end if;

  select
    pg_catalog.count(*),
    coalesce(
      pg_catalog.bool_and(
        keys.key = any (v_expected_review_record_keys)
      ),
      false
    )
  into
    v_review_record_key_count,
    v_review_record_keys_allowed
  from jsonb_object_keys(v_review_record) as keys(key);

  if v_review_record_key_count <> 23
     or not v_review_record_keys_allowed
     or v_review_record ->> 'contractVersion'
       is distinct from 'ai-chart-d1-palace-writing-human-review-record/v1'
     or v_review_record ->> 'task'
       is distinct from 'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD'
     or v_review_record ->> 'dataClassification'
       is distinct from 'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA'
     or v_review_record ->> 'permission'
       is distinct from 'REVIEW_AI_CHART_D1_PALACE_WRITING_PREVIEW'
     or v_review_record ->> 'decision'
       is distinct from 'APPROVED'
     or v_review_record -> 'issueCodes'
       is distinct from '[]'::jsonb
     or v_review_record ->> 'recordedAtAuthority'
       is distinct from 'TRUSTED_SERVER_CLOCK'
     or v_review_record ->> 'sourceBindingStatus'
       is distinct from 'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH'
     or v_review_record ->> 'authorizationStatus'
       is distinct from 'REQUEST_BOUND_SERVER_VERIFIED'
     or v_review_record ->> 'customerDeliveryStatus'
       is distinct from 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
     or v_review_record ->> 'reportId'
       is distinct from p_report_id::text
     or v_review_record ->> 'reportSnapshotSha256'
       is distinct from p_report_snapshot_sha256
     or v_review_record ->> 'artifactSourceSnapshotSha256'
       is distinct from p_report_snapshot_sha256
     or v_review_record ->> 'artifactPayloadSha256'
       is distinct from p_artifact_payload_sha256
     or v_review_record ->> 'gateFingerprint'
       is distinct from p_gate_fingerprint
     or v_review_record ->> 'recordFingerprint'
       is distinct from p_record_fingerprint then
    raise exception using
      errcode = '22023',
      message = 'ai_chart_report_delivery_review_record_invalid';
  end if;

  begin
    v_reviewer_id :=
      (v_review_record ->> 'reviewerId')::uuid;
    v_recorded_at :=
      (v_review_record ->> 'recordedAt')::timestamptz;
  exception
    when invalid_text_representation
      or datetime_field_overflow then
      raise exception using
        errcode = '22023',
        message = 'ai_chart_report_delivery_review_record_invalid';
  end;

  if v_recorded_at > v_now + interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'ai_chart_report_delivery_review_record_invalid';
  end if;

  select report.*
  into v_report
  from public.ai_chart_reports as report
  where id = p_report_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ai_chart_report_delivery_report_not_found';
  end if;

  if v_report.user_id is distinct from p_expected_owner_user_id then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_owner_mismatch';
  end if;

  if v_report.chart_snapshot is null
     or v_report.chart_snapshot_sha256 is null then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_snapshot_missing';
  end if;

  if v_report.chart_snapshot_sha256
       is distinct from p_report_snapshot_sha256 then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_snapshot_mismatch';
  end if;

  select ledger.*
  into v_ledger
  from public.ai_chart_report_review_ledger as ledger
  where ledger.record_fingerprint = p_record_fingerprint;

  if found then
    if v_ledger.report_id is distinct from p_report_id
       or v_ledger.reviewer_id is distinct from v_reviewer_id
       or v_ledger.decision is distinct from 'APPROVED'
       or v_ledger.record_payload is distinct from v_review_record
       or v_ledger.record_payload_sha256
         is distinct from p_record_payload_sha256
       or v_ledger.envelope_fingerprint
         is distinct from p_envelope_fingerprint
       or v_ledger.report_snapshot_sha256
         is distinct from p_report_snapshot_sha256
       or v_ledger.gate_fingerprint
         is distinct from p_gate_fingerprint
       or v_ledger.artifact_payload_sha256
         is distinct from p_artifact_payload_sha256
       or v_ledger.ledger_receipt_fingerprint
         is distinct from p_ledger_receipt_fingerprint
       or v_ledger.recorded_at is distinct from v_recorded_at then
      raise exception using
        errcode = '23514',
        message = 'ai_chart_report_delivery_ledger_conflict';
    end if;
  else
    begin
      insert into public.ai_chart_report_review_ledger (
        report_id,
        reviewer_id,
        decision,
        record_payload,
        record_payload_sha256,
        record_fingerprint,
        envelope_fingerprint,
        report_snapshot_sha256,
        gate_fingerprint,
        artifact_payload_sha256,
        ledger_receipt_fingerprint,
        recorded_at
      ) values (
        p_report_id,
        v_reviewer_id,
        'APPROVED',
        v_review_record,
        p_record_payload_sha256,
        p_record_fingerprint,
        p_envelope_fingerprint,
        p_report_snapshot_sha256,
        p_gate_fingerprint,
        p_artifact_payload_sha256,
        p_ledger_receipt_fingerprint,
        v_recorded_at
      )
      returning *
      into v_ledger;
    exception
      when unique_violation then
        raise exception using
          errcode = '23505',
          message = 'ai_chart_report_delivery_ledger_conflict';
    end;
  end if;

  select delivery.*
  into v_delivery
  from public.ai_chart_report_deliveries as delivery
  where delivery.idempotency_key = p_idempotency_key;

  if found then
    if v_delivery.report_id is distinct from p_report_id
       or v_delivery.review_ledger_id is distinct from v_ledger.id
       or v_delivery.contract_fingerprint
         is distinct from p_contract_fingerprint
       or v_delivery.source_coordination_fingerprint
         is distinct from p_source_coordination_fingerprint
       or v_delivery.report_snapshot_sha256
         is distinct from p_report_snapshot_sha256
       or v_delivery.gate_fingerprint
         is distinct from p_gate_fingerprint
       or v_delivery.record_fingerprint
         is distinct from p_record_fingerprint
       or v_delivery.record_payload_sha256
         is distinct from p_record_payload_sha256
       or v_delivery.envelope_fingerprint
         is distinct from p_envelope_fingerprint
       or v_delivery.artifact_payload_sha256
         is distinct from p_artifact_payload_sha256
       or v_delivery.report_content_sha256
         is distinct from p_report_content_sha256
       or v_delivery.delivery_claim_fingerprint
         is distinct from p_delivery_claim_fingerprint
       or v_delivery.delivery_receipt_fingerprint
         is distinct from p_delivery_receipt_fingerprint
       or v_delivery.status is distinct from 'published'
       or v_report.status is distinct from 'completed'
       or v_report.report_content is distinct from p_report_content then
      raise exception using
        errcode = '23514',
        message = 'ai_chart_report_delivery_idempotency_conflict';
    end if;

    return query
    select
      'EXISTING_EXACT_MATCH'::text,
      v_ledger.ledger_receipt_fingerprint,
      v_delivery.delivery_claim_fingerprint,
      v_delivery.delivery_receipt_fingerprint,
      v_delivery.report_content_sha256;
    return;
  end if;

  if exists (
    select 1
    from public.ai_chart_report_deliveries as delivery
    where delivery.report_id = p_report_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_idempotency_conflict';
  end if;

  if v_report.payment_status is distinct from 'paid' then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_payment_required';
  end if;

  if v_report.status is distinct from 'pending' then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_report_state_conflict';
  end if;

  if v_report.report_content is not null
     and pg_catalog.btrim(v_report.report_content) <> '' then
    raise exception using
      errcode = '23514',
      message = 'ai_chart_report_delivery_report_state_conflict';
  end if;

  update public.ai_chart_reports
  set
    status = 'completed',
    report_content = p_report_content,
    completed_at = v_now,
    updated_at = v_now,
    error_message = null
  where id = p_report_id
    and user_id = p_expected_owner_user_id
    and payment_status = 'paid'
    and status = 'pending'
    and (
      report_content is null
      or pg_catalog.btrim(report_content) = ''
    );

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows <> 1 then
    raise exception using
      errcode = '40001',
      message = 'ai_chart_report_delivery_report_state_conflict';
  end if;

  begin
    insert into public.ai_chart_report_deliveries (
      report_id,
      review_ledger_id,
      idempotency_key,
      contract_fingerprint,
      source_coordination_fingerprint,
      report_snapshot_sha256,
      gate_fingerprint,
      record_fingerprint,
      record_payload_sha256,
      envelope_fingerprint,
      artifact_payload_sha256,
      report_content_sha256,
      delivery_claim_fingerprint,
      delivery_receipt_fingerprint,
      status,
      claimed_at,
      published_at
    ) values (
      p_report_id,
      v_ledger.id,
      p_idempotency_key,
      p_contract_fingerprint,
      p_source_coordination_fingerprint,
      p_report_snapshot_sha256,
      p_gate_fingerprint,
      p_record_fingerprint,
      p_record_payload_sha256,
      p_envelope_fingerprint,
      p_artifact_payload_sha256,
      p_report_content_sha256,
      p_delivery_claim_fingerprint,
      p_delivery_receipt_fingerprint,
      'published',
      v_now,
      v_now
    )
    returning *
    into v_delivery;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'ai_chart_report_delivery_idempotency_conflict';
  end;

  return query
  select
    'PUBLISHED'::text,
    v_ledger.ledger_receipt_fingerprint,
    v_delivery.delivery_claim_fingerprint,
    v_delivery.delivery_receipt_fingerprint,
    v_delivery.report_content_sha256;
end;
$$;

revoke all
on function public.deliver_ai_chart_report_after_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function public.deliver_ai_chart_report_after_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to service_role;

commit;
