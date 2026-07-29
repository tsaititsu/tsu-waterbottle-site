create function pg_temp.deliver_synthetic_ai_chart_report(
  p_report_id uuid,
  p_owner_user_id uuid,
  p_record_seed text,
  p_idempotency_seed text,
  p_report_content_sha256 text,
  p_report_content text,
  p_gate_seed text default '5',
  p_snapshot_seed text default '4',
  p_artifact_seed text default '7',
  p_ledger_receipt_seed text default '6',
  p_delivery_claim_seed text default '0',
  p_delivery_receipt_seed text default 'a',
  p_record_payload_seed text default null,
  p_envelope_seed text default '3',
  p_contract_seed text default 'd',
  p_source_coordination_seed text default 'e'
)
returns table (
  result_code text,
  ledger_receipt_fingerprint text,
  delivery_claim_fingerprint text,
  delivery_receipt_fingerprint text,
  report_content_sha256 text
)
language sql
volatile
set search_path = ''
as $$
  with review_record as (
    select jsonb_build_object(
      'artifactPayloadSha256', repeat(p_artifact_seed, 64),
      'artifactSourceSnapshotSha256', repeat(p_snapshot_seed, 64),
      'authorizationFingerprint', repeat('8', 64),
      'authorizationStatus', 'REQUEST_BOUND_SERVER_VERIFIED',
      'contractVersion', 'ai-chart-d1-palace-writing-human-review-record/v1',
      'customerDeliveryStatus', 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
      'dataClassification', 'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA',
      'decision', 'APPROVED',
      'gateFingerprint', repeat(p_gate_seed, 64),
      'issueCodes', '[]'::jsonb,
      'permission', 'REVIEW_AI_CHART_D1_PALACE_WRITING_PREVIEW',
      'proposalFingerprint', repeat('9', 64),
      'recordFingerprint', repeat(p_record_seed, 64),
      'recordedAt', '2026-07-28T00:00:00.000Z',
      'recordedAtAuthority', 'TRUSTED_SERVER_CLOCK',
      'reportId', p_report_id::text,
      'reportSnapshotSha256', repeat(p_snapshot_seed, 64),
      'restrictedArtifactFingerprint', repeat('a', 64),
      'reviewCommandFingerprint', repeat('b', 64),
      'reviewerId', '30000000-0000-4000-8000-000000000001',
      'sourceBindingFingerprint', repeat('c', 64),
      'sourceBindingStatus', 'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH',
      'task', 'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD'
    )::text as payload
  )
  select delivery.*
  from review_record
  cross join lateral
  public.deliver_ai_chart_report_after_review(
    p_report_id,
    p_owner_user_id,
    review_record.payload,
    repeat(p_snapshot_seed, 64),
    repeat(p_gate_seed, 64),
    repeat(p_record_seed, 64),
    case
      when p_record_payload_seed is null then
        encode(
          public.digest(
            convert_to(review_record.payload, 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      else repeat(p_record_payload_seed, 64)
    end,
    repeat(p_envelope_seed, 64),
    repeat(p_contract_seed, 64),
    repeat(p_source_coordination_seed, 64),
    repeat(p_idempotency_seed, 64),
    repeat(p_artifact_seed, 64),
    repeat(p_ledger_receipt_seed, 64),
    repeat(p_delivery_claim_seed, 64),
    repeat(p_delivery_receipt_seed, 64),
    p_report_content_sha256,
    p_report_content
  ) as delivery;
$$;

insert into public.ai_chart_reports (
  id,
  user_id,
  payment_status,
  status,
  chart_snapshot,
  chart_snapshot_sha256
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'paid',
  'pending',
  '{"schemaVersion":"synthetic-ai-chart-snapshot/v1"}'::jsonb,
  repeat('4', 64)
);

set role service_role;

do $$
declare
  v_result record;
begin
  select *
  into strict v_result
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '1',
    'f',
    'a246a784c6434803d3cca3969143dfa10d5c8017db0ed85bd50d845569099309',
    'synthetic approved report content'
  );

  if v_result.result_code <> 'PUBLISHED'
     or v_result.ledger_receipt_fingerprint <> repeat('6', 64)
     or v_result.delivery_claim_fingerprint <> repeat('0', 64)
     or v_result.delivery_receipt_fingerprint <> repeat('a', 64)
     or v_result.report_content_sha256
       <> 'a246a784c6434803d3cca3969143dfa10d5c8017db0ed85bd50d845569099309' then
    raise exception 'trusted_delivery_first_publish_result_contract_failed';
  end if;
end
$$;

reset role;

insert into public.ai_chart_reports (
  id,
  user_id,
  payment_status,
  status,
  chart_snapshot,
  chart_snapshot_sha256
) values (
  '10000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000004',
  'paid',
  'pending',
  '{"schemaVersion":"synthetic-ai-chart-snapshot/v1"}'::jsonb,
  repeat('4', 64)
);

set role service_role;

do $$
begin
  perform *
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    'd',
    'e',
    '069c313d56a7a5029af10f2f95ccb7c2d409b2d43b8dd3580def12235f84ba6c',
    'synthetic second report content',
    p_ledger_receipt_seed => 'b',
    p_delivery_claim_seed => 'c',
    p_delivery_receipt_seed => 'd',
    p_record_payload_seed => 'f'
  );

  raise exception 'trusted_delivery_review_payload_hash_mismatch_was_not_rejected';
exception
  when invalid_parameter_value then
    if sqlerrm <>
      'ai_chart_report_delivery_review_record_hash_mismatch' then
      raise;
    end if;
end
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from public.ai_chart_report_review_ledger
    where report_id = '10000000-0000-4000-8000-000000000004'
  )
  or exists (
    select 1
    from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000004'
  )
  or not exists (
    select 1
    from public.ai_chart_reports
    where id = '10000000-0000-4000-8000-000000000004'
      and status = 'pending'
      and report_content is null
      and completed_at is null
  ) then
    raise exception 'trusted_delivery_review_payload_hash_rollback_failed';
  end if;
end
$$;

set role service_role;

do $$
begin
  perform *
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '1',
    'b',
    'a246a784c6434803d3cca3969143dfa10d5c8017db0ed85bd50d845569099309',
    'synthetic approved report content'
  );

  raise exception 'trusted_delivery_idempotency_conflict_was_not_rejected';
exception
  when check_violation then
    if sqlerrm <> 'ai_chart_report_delivery_idempotency_conflict' then
      raise;
    end if;
end
$$;

do $$
begin
  perform *
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '1',
    'f',
    'a246a784c6434803d3cca3969143dfa10d5c8017db0ed85bd50d845569099309',
    'synthetic approved report content',
    p_ledger_receipt_seed => 'd'
  );

  raise exception 'trusted_delivery_ledger_conflict_was_not_rejected';
exception
  when check_violation then
    if sqlerrm <> 'ai_chart_report_delivery_ledger_conflict' then
      raise;
    end if;
end
$$;

reset role;

insert into public.ai_chart_reports (
  id,
  user_id,
  payment_status,
  status,
  chart_snapshot,
  chart_snapshot_sha256
) values (
  '10000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003',
  'paid',
  'failed',
  '{"schemaVersion":"synthetic-ai-chart-snapshot/v1"}'::jsonb,
  repeat('4', 64)
);

set role service_role;

do $$
begin
  perform *
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'c',
    'd',
    '069c313d56a7a5029af10f2f95ccb7c2d409b2d43b8dd3580def12235f84ba6c',
    'synthetic second report content',
    p_ledger_receipt_seed => 'b',
    p_delivery_claim_seed => 'c',
    p_delivery_receipt_seed => 'd'
  );

  raise exception 'trusted_delivery_report_state_conflict_was_not_rejected';
exception
  when check_violation then
    if sqlerrm <> 'ai_chart_report_delivery_report_state_conflict' then
      raise;
    end if;
end
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from public.ai_chart_report_review_ledger
    where report_id = '10000000-0000-4000-8000-000000000003'
  )
  or exists (
    select 1
    from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000003'
  )
  or not exists (
    select 1
    from public.ai_chart_reports
    where id = '10000000-0000-4000-8000-000000000003'
      and status = 'failed'
      and report_content is null
      and completed_at is null
  ) then
    raise exception 'trusted_delivery_report_state_conflict_rollback_failed';
  end if;
end
$$;

do $$
begin
  begin
    update public.ai_chart_report_review_ledger
    set decision = 'REJECTED'
    where report_id = '10000000-0000-4000-8000-000000000001';

    raise exception 'trusted_delivery_ledger_update_was_not_rejected';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ai_chart_report_delivery_audit_immutable' then
        raise;
      end if;
  end;

  begin
    delete from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000001';

    raise exception 'trusted_delivery_receipt_delete_was_not_rejected';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ai_chart_report_delivery_audit_immutable' then
        raise;
      end if;
  end;
end
$$;

do $$
declare
  v_function regprocedure :=
    'public.deliver_ai_chart_report_after_review(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure;
begin
  if not (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.ai_chart_report_review_ledger'::regclass
  )
  or not (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.ai_chart_report_deliveries'::regclass
  )
  or (
    select count(*)
    from pg_catalog.pg_policy
    where polrelid in (
      'public.ai_chart_report_review_ledger'::regclass,
      'public.ai_chart_report_deliveries'::regclass
    )
  ) <> 0
  or not has_function_privilege(
    'service_role',
    v_function,
    'EXECUTE'
  )
  or has_function_privilege(
    'anon',
    v_function,
    'EXECUTE'
  )
  or has_function_privilege(
    'authenticated',
    v_function,
    'EXECUTE'
  )
  or has_table_privilege(
    'service_role',
    'public.ai_chart_report_review_ledger',
    'SELECT'
  )
  or has_table_privilege(
    'service_role',
    'public.ai_chart_report_deliveries',
    'INSERT'
  ) then
    raise exception 'trusted_delivery_role_and_rls_contract_failed';
  end if;
end
$$;

do $$
begin
  if (
    select count(*)
    from public.ai_chart_report_review_ledger
  ) <> 1
  or (
    select count(*)
    from public.ai_chart_report_deliveries
  ) <> 1
  or not exists (
    select 1
    from public.ai_chart_reports
    where id = '10000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and report_content = 'synthetic approved report content'
  ) then
    raise exception 'trusted_delivery_conflict_and_immutability_final_state_failed';
  end if;
end
$$;

reset role;

insert into public.ai_chart_reports (
  id,
  user_id,
  payment_status,
  status,
  chart_snapshot,
  chart_snapshot_sha256
) values (
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'paid',
  'pending',
  '{"schemaVersion":"synthetic-ai-chart-snapshot/v1"}'::jsonb,
  repeat('4', 64)
);

set role service_role;

do $$
begin
  perform *
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'b',
    'c',
    '069c313d56a7a5029af10f2f95ccb7c2d409b2d43b8dd3580def12235f84ba6c',
    'synthetic second report content',
    p_snapshot_seed => '9',
    p_ledger_receipt_seed => 'd',
    p_delivery_claim_seed => 'e',
    p_delivery_receipt_seed => 'f'
  );

  raise exception 'trusted_delivery_snapshot_mismatch_was_not_rejected';
exception
  when check_violation then
    if sqlerrm <> 'ai_chart_report_delivery_snapshot_mismatch' then
      raise;
    end if;
end
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from public.ai_chart_report_review_ledger
    where report_id = '10000000-0000-4000-8000-000000000002'
  )
  or exists (
    select 1
    from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000002'
  )
  or not exists (
    select 1
    from public.ai_chart_reports
    where id = '10000000-0000-4000-8000-000000000002'
      and status = 'pending'
      and report_content is null
      and completed_at is null
  ) then
    raise exception 'trusted_delivery_snapshot_mismatch_rollback_contract_failed';
  end if;
end
$$;

set role service_role;

do $$
declare
  v_result record;
begin
  select *
  into strict v_result
  from pg_temp.deliver_synthetic_ai_chart_report(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '1',
    'f',
    'a246a784c6434803d3cca3969143dfa10d5c8017db0ed85bd50d845569099309',
    'synthetic approved report content'
  );

  if v_result.result_code <> 'EXISTING_EXACT_MATCH' then
    raise exception 'trusted_delivery_exact_replay_result_contract_failed';
  end if;
end
$$;

reset role;

do $$
begin
  if (
    select count(*)
    from public.ai_chart_report_review_ledger
    where report_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1
  or (
    select count(*)
    from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'trusted_delivery_exact_replay_duplicate_write_contract_failed';
  end if;
end
$$;

reset role;

do $$
begin
  if not exists (
    select 1
    from public.ai_chart_reports
    where id = '10000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and report_content = 'synthetic approved report content'
      and completed_at is not null
      and error_message is null
  ) then
    raise exception 'trusted_delivery_first_publish_report_contract_failed';
  end if;

  if (
    select count(*)
    from public.ai_chart_report_review_ledger
    where report_id = '10000000-0000-4000-8000-000000000001'
      and decision = 'APPROVED'
  ) <> 1 then
    raise exception 'trusted_delivery_first_publish_ledger_contract_failed';
  end if;

  if (
    select count(*)
    from public.ai_chart_report_deliveries
    where report_id = '10000000-0000-4000-8000-000000000001'
      and status = 'published'
  ) <> 1 then
    raise exception 'trusted_delivery_first_publish_receipt_contract_failed';
  end if;
end
$$;
