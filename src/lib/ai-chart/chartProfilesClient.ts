'use client'

import type { AiChartBirthInputRequest } from './birthInput'
import type { MemberAiChartProfile } from './chartProfiles'
import { getAuthAccessToken } from '@/lib/mockAuth'

type MemberProfilesResponse =
  | { ok: true; profiles: MemberAiChartProfile[] }
  | { ok: false; message?: string }

type MemberProfileResponse =
  | { ok: true; profile: MemberAiChartProfile }
  | { ok: false; message?: string }

async function authorizedHeaders() {
  const accessToken = await getAuthAccessToken().catch(() => null)
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
}

export async function loadMemberAiChartProfiles() {
  const headers = await authorizedHeaders()

  if (!headers) {
    const sessionResponse = await fetch('/api/auth/line/session', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    const session = (await sessionResponse.json().catch(() => null)) as {
      user?: { id?: string } | null
    } | null

    if (!sessionResponse.ok || !session?.user?.id) {
      return { authenticated: false, profiles: [] } as const
    }
  }

  const response = await fetch('/api/account/chart-profiles', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
  })

  if (response.status === 401) {
    return { authenticated: false, profiles: [] } as const
  }

  const data = (await response.json().catch(() => null)) as MemberProfilesResponse | null
  if (!response.ok || !data?.ok) {
    throw new Error('member_chart_profiles_load_failed')
  }

  return { authenticated: true, profiles: data.profiles } as const
}

export async function saveMemberAiChartProfile(input: {
  id?: string
  category: string
  birthInput: AiChartBirthInputRequest
}) {
  const response = await fetch('/api/account/chart-profiles', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(await authorizedHeaders()),
    },
    body: JSON.stringify(input),
  })

  if (response.status === 401) throw new Error('member_chart_profile_session_expired')

  const data = (await response.json().catch(() => null)) as MemberProfileResponse | null
  if (!response.ok || !data?.ok) {
    throw new Error('member_chart_profile_save_failed')
  }

  return data.profile
}

export async function deleteMemberAiChartProfile(id: string) {
  const response = await fetch('/api/account/chart-profiles', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(await authorizedHeaders()),
    },
    body: JSON.stringify({ id }),
  })

  if (response.status === 401) throw new Error('member_chart_profile_session_expired')
  if (!response.ok) throw new Error('member_chart_profile_delete_failed')
}
