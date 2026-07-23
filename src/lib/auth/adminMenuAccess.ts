import type { UserProfile } from './types'

export type AdminMenuAccessState = 'idle' | 'checking' | 'authorized' | 'denied'

export type AdminMenuAccessSnapshot = {
  state: AdminMenuAccessState
  requestId: number
  subjectKey: string | null
}

type AdminMenuUser = Pick<UserProfile, 'id' | 'provider'>

type AdminSessionResponse = {
  ok: boolean
  json: () => Promise<unknown>
}

export type VerifyAdminMenuAccessDeps = {
  getAccessToken: () => Promise<string | null>
  fetchSession: (
    input: string,
    init: RequestInit,
  ) => Promise<AdminSessionResponse>
  signal?: AbortSignal
}

export type AdminMenuAccessController = {
  run: (user: AdminMenuUser | null) => Promise<void>
  cancel: () => void
}

type AdminMenuAccessControllerDeps = Omit<VerifyAdminMenuAccessDeps, 'signal'>

export function getAdminMenuSubjectKey(user: AdminMenuUser | null): string | null {
  return user ? `${user.provider}:${user.id}` : null
}

export function beginAdminMenuAccessCheck(
  user: AdminMenuUser | null,
  requestId: number,
): AdminMenuAccessSnapshot {
  const subjectKey = getAdminMenuSubjectKey(user)

  if (!user) return { state: 'idle', requestId, subjectKey }

  return { state: 'checking', requestId, subjectKey }
}

export function completeAdminMenuAccessCheck(
  snapshot: AdminMenuAccessSnapshot,
  requestId: number,
  result: Extract<AdminMenuAccessState, 'authorized' | 'denied'>,
): AdminMenuAccessSnapshot {
  if (snapshot.requestId !== requestId || snapshot.state !== 'checking') return snapshot
  return { ...snapshot, state: result }
}

export function canShowAdminMenu(
  snapshot: AdminMenuAccessSnapshot,
  user: AdminMenuUser | null,
): boolean {
  return (
    snapshot.state === 'authorized' &&
    snapshot.subjectKey !== null &&
    snapshot.subjectKey === getAdminMenuSubjectKey(user)
  )
}

export function shouldRecheckAdminMenuOnOpen(
  menuOpen: boolean,
  user: AdminMenuUser | null,
): boolean {
  return !menuOpen && user !== null
}

function isAuthorizedAdminSession(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false

  const record = payload as Record<string, unknown>
  return record.ok === true && record.isAdmin === true
}

export async function verifyAdminMenuAccess(
  user: AdminMenuUser | null,
  deps: VerifyAdminMenuAccessDeps,
): Promise<Extract<AdminMenuAccessState, 'idle' | 'authorized' | 'denied'>> {
  if (!user) return 'idle'

  try {
    const accessToken = await deps.getAccessToken()
    if (!accessToken) return 'denied'

    const response = await deps.fetchSession('/api/admin/session', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: deps.signal,
    })

    if (!response.ok) return 'denied'

    const payload = await response.json()
    return isAuthorizedAdminSession(payload) ? 'authorized' : 'denied'
  } catch {
    return 'denied'
  }
}

export function createAdminMenuAccessController(
  deps: AdminMenuAccessControllerDeps,
  onSnapshot: (snapshot: AdminMenuAccessSnapshot) => void,
): AdminMenuAccessController {
  let requestId = 0
  let snapshot = beginAdminMenuAccessCheck(null, requestId)
  let activeController: AbortController | null = null

  const publish = (nextSnapshot: AdminMenuAccessSnapshot) => {
    snapshot = nextSnapshot
    onSnapshot(nextSnapshot)
  }

  return {
    async run(user) {
      requestId += 1
      activeController?.abort()

      const currentRequestId = requestId
      const startedAccess = beginAdminMenuAccessCheck(user, currentRequestId)
      publish(startedAccess)

      if (startedAccess.state !== 'checking') {
        activeController = null
        return
      }

      const controller = new AbortController()
      activeController = controller
      const result = await verifyAdminMenuAccess(user, {
        ...deps,
        signal: controller.signal,
      })

      if (controller.signal.aborted || result === 'idle') return

      const completedAccess = completeAdminMenuAccessCheck(
        snapshot,
        currentRequestId,
        result,
      )

      if (completedAccess !== snapshot) publish(completedAccess)
      if (activeController === controller) activeController = null
    },
    cancel() {
      requestId += 1
      activeController?.abort()
      activeController = null
    },
  }
}
