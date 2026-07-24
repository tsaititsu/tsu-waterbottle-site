import type { UserProfile } from './types'
import { getAdminMenuSubjectKey } from './adminMenuAccess'

export type AdminPageAccessState =
  | 'checking'
  | 'unauthenticated'
  | 'forbidden'
  | 'authorized'

export type AdminPageAccessSnapshot = {
  state: AdminPageAccessState
  requestId: number
  subjectKey: string | null
}

type AdminPageUser = Pick<UserProfile, 'id' | 'provider'>

type AdminSessionResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type AdminPageAccessDeps = {
  getAccessToken: () => Promise<string | null>
  fetchSession: (input: string, init: RequestInit) => Promise<AdminSessionResponse>
}

export type AdminPageAccessController = {
  run: (user: AdminPageUser | null) => Promise<void>
  cancel: () => void
}

function isExactAuthorizedPayload(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return (
    keys.length === 2 &&
    keys[0] === 'isAdmin' &&
    keys[1] === 'ok' &&
    record.ok === true &&
    record.isAdmin === true
  )
}

export function createAdminPageAccessController(
  deps: AdminPageAccessDeps,
  onSnapshot: (snapshot: AdminPageAccessSnapshot) => void,
): AdminPageAccessController {
  let requestId = 0
  let activeController: AbortController | null = null

  const publishIfCurrent = (
    currentRequestId: number,
    controller: AbortController,
    state: AdminPageAccessState,
    subjectKey: string | null,
  ) => {
    if (requestId !== currentRequestId || controller.signal.aborted) return
    onSnapshot({ state, requestId: currentRequestId, subjectKey })
  }

  return {
    async run(user) {
      requestId += 1
      activeController?.abort()

      const currentRequestId = requestId
      const subjectKey = getAdminMenuSubjectKey(user)
      if (!user) {
        activeController = null
        onSnapshot({ state: 'unauthenticated', requestId: currentRequestId, subjectKey })
        return
      }

      const controller = new AbortController()
      activeController = controller
      onSnapshot({ state: 'checking', requestId: currentRequestId, subjectKey })

      try {
        const accessToken = await deps.getAccessToken()
        if (!accessToken) {
          publishIfCurrent(currentRequestId, controller, 'unauthenticated', subjectKey)
          return
        }

        const response = await deps.fetchSession('/api/admin/session', {
          cache: 'no-store',
          headers: { authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })

        if (response.status === 401) {
          publishIfCurrent(currentRequestId, controller, 'unauthenticated', subjectKey)
          return
        }
        if (!response.ok) {
          publishIfCurrent(currentRequestId, controller, 'forbidden', subjectKey)
          return
        }

        const payload = await response.json()
        publishIfCurrent(
          currentRequestId,
          controller,
          isExactAuthorizedPayload(payload) ? 'authorized' : 'forbidden',
          subjectKey,
        )
      } catch {
        publishIfCurrent(currentRequestId, controller, 'forbidden', subjectKey)
      } finally {
        if (activeController === controller) activeController = null
      }
    },
    cancel() {
      requestId += 1
      activeController?.abort()
      activeController = null
    },
  }
}
