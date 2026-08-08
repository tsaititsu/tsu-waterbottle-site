import 'server-only'

import { createZiweiGptPayload } from '@/features/ziwei-chart/package'
import type { CanonicalAiChartBirthInput } from '@/lib/ai-chart/birthInput'
import {
  mapAiChartProfileRow,
  type AiChartProfileRow,
  type MemberAiChartProfile,
} from '@/lib/ai-chart/chartProfiles'
import { getSupabaseAdmin } from './admin'

const CHART_PROFILE_COLUMNS =
  'id,user_id,category,name,gender,solar_date,birth_time,birth_place,ziwei_payload'

function buildChartProfilePayload(input: {
  userId: string
  category: string
  birthInput: CanonicalAiChartBirthInput
}) {
  const engineInput = {
    solarDate: input.birthInput.solarDate,
    timeIndex: input.birthInput.timeIndex,
    gender: input.birthInput.gender,
    ...(input.birthInput.name ? { name: input.birthInput.name } : {}),
    birthPlace: input.birthInput.birthPlace,
    fixLeap: input.birthInput.fixLeap,
  }
  const chart = createZiweiGptPayload(engineInput).chart

  return {
    user_id: input.userId,
    category: input.category,
    name: input.birthInput.name ?? null,
    gender: input.birthInput.gender,
    solar_date: input.birthInput.solarDate,
    birth_time: String(input.birthInput.timeIndex),
    birth_place: input.birthInput.birthPlace,
    ziwei_payload: {
      chart,
      fixLeap: input.birthInput.fixLeap,
    },
    updated_at: new Date().toISOString(),
  }
}

function requireMappedProfile(row: unknown): MemberAiChartProfile {
  const profile = mapAiChartProfileRow(row as AiChartProfileRow)
  if (!profile) throw new Error('invalid_ai_chart_profile_row')
  return profile
}

export async function listAiChartProfilesForUser(userId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('chart_profiles')
    .select(CHART_PROFILE_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error('ai_chart_profiles_load_failed')
  return (data ?? []).map(requireMappedProfile)
}

export async function saveAiChartProfileForUser(input: {
  userId: string
  id?: string
  category: string
  birthInput: CanonicalAiChartBirthInput
}) {
  const supabase = getSupabaseAdmin()
  const payload = buildChartProfilePayload(input)

  if (input.id) {
    const { data, error } = await supabase
      .from('chart_profiles')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .select(CHART_PROFILE_COLUMNS)
      .maybeSingle()

    if (error) throw new Error('ai_chart_profile_update_failed')
    return data ? requireMappedProfile(data) : null
  }

  const { data, error } = await supabase
    .from('chart_profiles')
    .insert(payload)
    .select(CHART_PROFILE_COLUMNS)
    .single()

  if (error) throw new Error('ai_chart_profile_insert_failed')
  return requireMappedProfile(data)
}

export async function deleteAiChartProfileForUser(input: {
  userId: string
  id: string
}) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('chart_profiles')
    .delete()
    .eq('id', input.id)
    .eq('user_id', input.userId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error('ai_chart_profile_delete_failed')
  return Boolean(data)
}
