import { NextResponse } from 'next/server'
import {
  parseAiChartBirthInput,
  type CanonicalAiChartBirthInput,
} from '@/lib/ai-chart/birthInput'
import {
  normalizeAiChartProfileCategory,
  normalizeAiChartProfileId,
  type MemberAiChartProfile,
} from '@/lib/ai-chart/chartProfiles'

type ResolveUserId = (request: Request) => Promise<string | null>

type ChartProfileDependencies = {
  resolveUserId: ResolveUserId
  listProfiles: (userId: string) => Promise<MemberAiChartProfile[]>
  saveProfile: (input: {
    userId: string
    id?: string
    category: string
    birthInput: CanonicalAiChartBirthInput
  }) => Promise<MemberAiChartProfile | null>
  deleteProfile: (input: { userId: string; id: string }) => Promise<boolean>
}

const SAVE_FIELDS = new Set(['id', 'category', 'birthInput'])
const DELETE_FIELDS = new Set(['id'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyFields(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((field) => allowed.has(field))
}

function privateJson(body: unknown, init?: { status?: number }) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

async function requireUserId(request: Request, resolveUserId: ResolveUserId) {
  return resolveUserId(request).catch(() => null)
}

export async function handleListAiChartProfiles(
  request: Request,
  deps: Pick<ChartProfileDependencies, 'resolveUserId' | 'listProfiles'>,
) {
  const userId = await requireUserId(request, deps.resolveUserId)
  if (!userId) {
    return privateJson({ ok: false, message: '請先登入會員。' }, { status: 401 })
  }

  try {
    const profiles = await deps.listProfiles(userId)
    return privateJson({ ok: true, profiles })
  } catch {
    console.error('Failed to list member AI chart profiles')
    return privateJson(
      { ok: false, message: '讀取會員命盤失敗，請稍後再試。' },
      { status: 500 },
    )
  }
}

export async function handleSaveAiChartProfile(
  request: Request,
  body: unknown,
  deps: Pick<ChartProfileDependencies, 'resolveUserId' | 'saveProfile'>,
) {
  const userId = await requireUserId(request, deps.resolveUserId)
  if (!userId) {
    return privateJson({ ok: false, message: '請先登入會員。' }, { status: 401 })
  }

  if (!isPlainObject(body) || !hasOnlyFields(body, SAVE_FIELDS)) {
    return privateJson({ ok: false, message: '命盤資料格式錯誤。' }, { status: 400 })
  }

  const category = normalizeAiChartProfileCategory(body.category)
  const id = body.id === undefined ? undefined : normalizeAiChartProfileId(body.id)
  const birthInput = parseAiChartBirthInput(body.birthInput)

  if (!category || (body.id !== undefined && !id) || !birthInput.ok) {
    return privateJson({ ok: false, message: '命盤資料格式錯誤。' }, { status: 400 })
  }

  try {
    const profile = await deps.saveProfile({
      userId,
      ...(id ? { id } : {}),
      category,
      birthInput: birthInput.value,
    })

    if (!profile) {
      return privateJson({ ok: false, message: '找不到這張命盤。' }, { status: 404 })
    }

    return privateJson({ ok: true, profile })
  } catch {
    console.error('Failed to save member AI chart profile')
    return privateJson(
      { ok: false, message: '儲存會員命盤失敗，請稍後再試。' },
      { status: 500 },
    )
  }
}

export async function handleDeleteAiChartProfile(
  request: Request,
  body: unknown,
  deps: Pick<ChartProfileDependencies, 'resolveUserId' | 'deleteProfile'>,
) {
  const userId = await requireUserId(request, deps.resolveUserId)
  if (!userId) {
    return privateJson({ ok: false, message: '請先登入會員。' }, { status: 401 })
  }

  if (!isPlainObject(body) || !hasOnlyFields(body, DELETE_FIELDS)) {
    return privateJson({ ok: false, message: '命盤資料格式錯誤。' }, { status: 400 })
  }

  const id = normalizeAiChartProfileId(body.id)
  if (!id) {
    return privateJson({ ok: false, message: '找不到這張命盤。' }, { status: 404 })
  }

  try {
    const deleted = await deps.deleteProfile({ userId, id })
    if (!deleted) {
      return privateJson({ ok: false, message: '找不到這張命盤。' }, { status: 404 })
    }
    return privateJson({ ok: true })
  } catch {
    console.error('Failed to delete member AI chart profile')
    return privateJson(
      { ok: false, message: '刪除會員命盤失敗，請稍後再試。' },
      { status: 500 },
    )
  }
}
