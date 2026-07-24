import type { UserProfile } from '@/lib/auth/types'
import { getAdminMenuSubjectKey } from '@/lib/auth/adminMenuAccess'

type AdminRecordRequestUser = Pick<UserProfile, 'id' | 'provider'>

export type AdminRecordRequestResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type AdminRecordRequestDeps<TResult> = {
  getCurrentUser: () => AdminRecordRequestUser | null
  getAccessToken: () => Promise<string | null>
  fetchResponse: (
    accessToken: string,
    signal: AbortSignal,
  ) => Promise<AdminRecordRequestResponse>
  classifyResponse: (
    response: AdminRecordRequestResponse,
    body: unknown,
  ) => TResult
}

type AdminRecordRequestSnapshotBase = {
  requestId: number
  subjectKey: string | null
}

export type AdminRecordRequestSnapshot<TResult> =
  | (AdminRecordRequestSnapshotBase & {
    state: 'loading'
    result?: never
  })
  | (AdminRecordRequestSnapshotBase & {
    state: 'unauthorized'
    result?: never
  })
  | (AdminRecordRequestSnapshotBase & {
    state: 'error'
    result?: never
  })
  | (AdminRecordRequestSnapshotBase & {
    state: 'result'
    result: TResult
  })

export type AdminRecordRequestController = {
  run: (user: AdminRecordRequestUser | null) => Promise<void>
  cancel: () => void
}

export function createAdminRecordRequestController<TResult>(
  deps: AdminRecordRequestDeps<TResult>,
  onSnapshot: (snapshot: AdminRecordRequestSnapshot<TResult>) => void,
): AdminRecordRequestController {
  let requestId = 0
  let mounted = true
  let activeController: AbortController | null = null

  const isCurrent = (
    currentRequestId: number,
    controller: AbortController,
    subjectKey: string,
  ) => (
    mounted &&
    requestId === currentRequestId &&
    activeController === controller &&
    !controller.signal.aborted &&
    getAdminMenuSubjectKey(deps.getCurrentUser()) === subjectKey
  )

  return {
    async run(user) {
      if (!mounted) return

      requestId += 1
      activeController?.abort()

      const currentRequestId = requestId
      const subjectKey = getAdminMenuSubjectKey(user)
      if (!subjectKey) {
        activeController = null
        onSnapshot({
          state: 'unauthorized',
          requestId: currentRequestId,
          subjectKey,
        })
        return
      }

      const controller = new AbortController()
      activeController = controller
      if (!isCurrent(currentRequestId, controller, subjectKey)) return
      onSnapshot({
        state: 'loading',
        requestId: currentRequestId,
        subjectKey,
      })

      try {
        const accessToken = await deps.getAccessToken()
        if (!isCurrent(currentRequestId, controller, subjectKey)) return
        if (!accessToken) {
          onSnapshot({
            state: 'unauthorized',
            requestId: currentRequestId,
            subjectKey,
          })
          return
        }

        if (!isCurrent(currentRequestId, controller, subjectKey)) return
        const response = await deps.fetchResponse(accessToken, controller.signal)
        if (!isCurrent(currentRequestId, controller, subjectKey)) return

        const body = await response.json()
        if (!isCurrent(currentRequestId, controller, subjectKey)) return

        const result = deps.classifyResponse(response, body)
        if (!isCurrent(currentRequestId, controller, subjectKey)) return
        onSnapshot({
          state: 'result',
          requestId: currentRequestId,
          subjectKey,
          result,
        })
      } catch {
        if (!isCurrent(currentRequestId, controller, subjectKey)) return
        onSnapshot({
          state: 'error',
          requestId: currentRequestId,
          subjectKey,
        })
      } finally {
        if (activeController === controller) activeController = null
      }
    },
    cancel() {
      mounted = false
      requestId += 1
      activeController?.abort()
      activeController = null
    },
  }
}
