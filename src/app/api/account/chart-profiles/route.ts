import {
  handleDeleteAiChartProfile,
  handleListAiChartProfiles,
  handleSaveAiChartProfile,
} from './handler'
import {
  LINE_SESSION_COOKIE,
  readLineSessionCookieValue,
} from '@/lib/auth/line'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import {
  deleteAiChartProfileForUser,
  listAiChartProfilesForUser,
  saveAiChartProfileForUser,
} from '@/lib/supabase/chartProfiles'

export const dynamic = 'force-dynamic'

const STRICT_BEARER_PATTERN = /^Bearer [^\s]+$/
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readRequestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  for (const entry of cookieHeader.split(';')) {
    const trimmed = entry.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 0 || trimmed.slice(0, separatorIndex) !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(separatorIndex + 1))
    } catch {
      return null
    }
  }

  return null
}

async function resolveProfileUserId(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization !== null) {
    if (!STRICT_BEARER_PATTERN.test(authorization)) return null
    return getUserIdFromRequest(request).catch(() => null)
  }

  const cookieValue = readRequestCookie(request, LINE_SESSION_COOKIE)
  if (!cookieValue) return null

  const user = (() => {
    try {
      return readLineSessionCookieValue(cookieValue)
    } catch {
      return null
    }
  })()

  return user?.id && USER_ID_PATTERN.test(user.id) ? user.id : null
}

const dependencies = {
  resolveUserId: resolveProfileUserId,
  listProfiles: listAiChartProfilesForUser,
  saveProfile: saveAiChartProfileForUser,
  deleteProfile: deleteAiChartProfileForUser,
}

export async function GET(request: Request) {
  return handleListAiChartProfiles(request, dependencies)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  return handleSaveAiChartProfile(request, body, dependencies)
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  return handleDeleteAiChartProfile(request, body, dependencies)
}
