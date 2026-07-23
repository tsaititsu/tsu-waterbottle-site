'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { getAuthAccessToken } from '@/lib/mockAuth'
import { classifyAdminDetailResponse } from './adminRecordState'
import AdminDataState from './AdminDataState'

type AdminRecordDetailProps<T> = {
  endpoint: string
  responseKey: string
  backHref: string
  backLabel: string
  render: (record: T) => ReactNode
}

export default function AdminRecordDetail<T>({
  endpoint,
  responseKey,
  backHref,
  backLabel,
  render,
}: AdminRecordDetailProps<T>) {
  const [record, setRecord] = useState<T | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unauthorized'>('loading')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadRecord() {
      setState('loading')
      setMessage('')

      try {
        const accessToken = await getAuthAccessToken()
        if (!accessToken) {
          setState('unauthorized')
          return
        }

        const response = await fetch(endpoint, {
          cache: 'no-store',
          headers: { authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })
        const body = (await response.json()) as { ok?: boolean; error?: string; [key: string]: unknown }
        const result = classifyAdminDetailResponse<T>(response.status, response.ok, body, responseKey)
        if (result.state === 'unauthorized') {
          setState('unauthorized')
          return
        }
        if (result.state === 'error') {
          setMessage(result.message)
          setState('error')
          return
        }

        setRecord(result.record)
        setState('ready')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMessage('讀取資料失敗，請稍後重試。')
        setState('error')
      }
    }

    void loadRecord()
    return () => controller.abort()
  }, [endpoint, reloadKey, responseKey])

  return (
    <section aria-busy={state === 'loading'} className="grid gap-5">
      <Link
        className="focus-ring w-fit rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple"
        href={backHref}
      >
        ← {backLabel}
      </Link>
      {state === 'loading' ? <AdminDataState state="loading" /> : null}
      {state === 'unauthorized' ? <AdminDataState state="unauthorized" /> : null}
      {state === 'error' ? (
        <AdminDataState message={message} onRetry={() => setReloadKey((value) => value + 1)} state="error" />
      ) : null}
      {state === 'ready' && record ? render(record) : null}
    </section>
  )
}
