'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { UserProfile } from '@/lib/auth/types'
import { getAuthAccessToken, getMockUser, subscribeAuthChange } from '@/lib/mockAuth'
import { classifyAdminDetailResponse } from './adminRecordState'
import {
  createAdminRecordRequestController,
  type AdminRecordRequestResponse,
} from './adminRecordRequest'
import AdminDataState from './AdminDataState'

export type AdminRecordDetailRequestRuntime = {
  getCurrentUser: () => Pick<UserProfile, 'id' | 'provider'> | null
  getAccessToken: () => Promise<string | null>
  fetchResponse: (
    endpoint: string,
    accessToken: string,
    signal: AbortSignal,
  ) => Promise<AdminRecordRequestResponse>
  subscribeAuthChange: (callback: () => void) => () => void
}

type AdminRecordDetailProps<T> = {
  endpoint: string
  responseKey: string
  backHref: string
  backLabel: string
  render: (record: T) => ReactNode
  validateRecord: (value: unknown) => value is T
  requestRuntime?: AdminRecordDetailRequestRuntime
}

type AdminRecordDetailState<T> =
  | {
      requestKey: string
      state: 'loading' | 'unauthorized'
      record: null
      message: ''
    }
  | {
      requestKey: string
      state: 'error'
      record: null
      message: string
    }
  | {
      requestKey: string
      state: 'ready'
      record: T
      message: ''
    }

const defaultRequestRuntime: AdminRecordDetailRequestRuntime = {
  getCurrentUser: getMockUser,
  getAccessToken: getAuthAccessToken,
  fetchResponse: (endpoint, accessToken, signal) =>
    fetch(endpoint, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${accessToken}` },
      signal,
    }),
  subscribeAuthChange,
}

export function createAdminRecordDetailRequestKey(endpoint: string, responseKey: string) {
  return JSON.stringify([responseKey, endpoint])
}

export default function AdminRecordDetail<T>({
  endpoint,
  responseKey,
  backHref,
  backLabel,
  render,
  validateRecord,
  requestRuntime = defaultRequestRuntime,
}: AdminRecordDetailProps<T>) {
  const currentRequestKey = createAdminRecordDetailRequestKey(endpoint, responseKey)
  const [detailState, setDetailState] = useState<AdminRecordDetailState<T>>(() => ({
    requestKey: currentRequestKey,
    state: 'loading',
    record: null,
    message: '',
  }))
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = createAdminRecordRequestController(
      {
        getCurrentUser: requestRuntime.getCurrentUser,
        getAccessToken: requestRuntime.getAccessToken,
        fetchResponse: (accessToken, signal) =>
          requestRuntime.fetchResponse(endpoint, accessToken, signal),
        classifyResponse: (response, body) =>
          classifyAdminDetailResponse(
            response.status,
            response.ok,
            body,
            responseKey,
            validateRecord,
          ),
      },
      (snapshot) => {
        if (snapshot.state === 'loading') {
          setDetailState({
            requestKey: currentRequestKey,
            state: 'loading',
            record: null,
            message: '',
          })
          return
        }
        if (snapshot.state === 'unauthorized') {
          setDetailState({
            requestKey: currentRequestKey,
            state: 'unauthorized',
            record: null,
            message: '',
          })
          return
        }
        if (snapshot.state === 'error') {
          setDetailState({
            requestKey: currentRequestKey,
            state: 'error',
            record: null,
            message: '讀取資料失敗，請稍後重試。',
          })
          return
        }

        const result = snapshot.result
        if (result.state === 'unauthorized') {
          setDetailState({
            requestKey: currentRequestKey,
            state: 'unauthorized',
            record: null,
            message: '',
          })
          return
        }
        if (result.state === 'error') {
          setDetailState({
            requestKey: currentRequestKey,
            state: 'error',
            record: null,
            message: result.message,
          })
          return
        }

        setDetailState({
          requestKey: currentRequestKey,
          state: 'ready',
          record: result.record,
          message: '',
        })
      },
    )

    const run = () => void controller.run(requestRuntime.getCurrentUser())
    run()
    const unsubscribe = requestRuntime.subscribeAuthChange(run)
    return () => {
      controller.cancel()
      unsubscribe()
    }
  }, [currentRequestKey, endpoint, reloadKey, requestRuntime, responseKey, validateRecord])

  const visibleState = detailState.requestKey === currentRequestKey
    ? detailState
    : {
        requestKey: currentRequestKey,
        state: 'loading' as const,
        record: null,
        message: '' as const,
      }

  return (
    <section
      aria-busy={visibleState.state === 'loading'}
      className="grid min-w-0 gap-5 overflow-x-hidden"
    >
      <Link
        className="focus-ring w-fit rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple"
        href={backHref}
      >
        ← {backLabel}
      </Link>
      {visibleState.state === 'loading' ? <AdminDataState state="loading" /> : null}
      {visibleState.state === 'unauthorized' ? <AdminDataState state="unauthorized" /> : null}
      {visibleState.state === 'error' ? (
        <AdminDataState
          message={visibleState.message}
          onRetry={() => setReloadKey((value) => value + 1)}
          state="error"
        />
      ) : null}
      {visibleState.state === 'ready' ? render(visibleState.record) : null}
    </section>
  )
}
