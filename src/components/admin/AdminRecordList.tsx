'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { getAuthAccessToken } from '@/lib/mockAuth'
import {
  buildAdminListRequestUrl,
  classifyAdminListResponse,
  type AdminListFilters,
  type AdminListMeta,
} from './adminRecordState'
import AdminDataState from './AdminDataState'
import AdminPagination from './AdminPagination'

type AdminRecord = { id: string }

type AdminRecordColumn<T extends AdminRecord> = {
  key: string
  label: string
  render: (record: T) => ReactNode
}

type AdminRecordListProps<T extends AdminRecord> = {
  endpoint: string
  responseKey: string
  detailBasePath: string
  searchLabel: string
  emptyMessage: string
  columns: Array<AdminRecordColumn<T>>
  renderMobile: (record: T) => ReactNode
  statusOptions?: Array<{ value: string; label: string }>
}

const initialFilters: AdminListFilters = { q: '', from: '', to: '', status: '' }

export default function AdminRecordList<T extends AdminRecord>({
  endpoint,
  responseKey,
  detailBasePath,
  searchLabel,
  emptyMessage,
  columns,
  renderMobile,
  statusOptions = [],
}: AdminRecordListProps<T>) {
  const [records, setRecords] = useState<T[]>([])
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 0 })
  const [draftFilters, setDraftFilters] = useState<AdminListFilters>(initialFilters)
  const [filters, setFilters] = useState<AdminListFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unauthorized'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadRecords() {
      setState('loading')
      setErrorMessage('')

      try {
        const accessToken = await getAuthAccessToken()
        if (!accessToken) {
          setState('unauthorized')
          return
        }

        const response = await fetch(buildAdminListRequestUrl(endpoint, page, filters), {
          cache: 'no-store',
          headers: { authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })
        const body = (await response.json()) as {
          ok?: boolean
          error?: string
          meta?: AdminListMeta
          [key: string]: unknown
        }

        const result = classifyAdminListResponse<T>(response.status, response.ok, body, responseKey)
        if (result.state === 'unauthorized') {
          setState('unauthorized')
          return
        }
        if (result.state === 'error') {
          setErrorMessage(result.message)
          setState('error')
          return
        }

        setRecords(result.records)
        setMeta(result.meta)
        setState(result.state)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setErrorMessage('讀取資料失敗，請稍後重試。')
        setState('error')
      }
    }

    void loadRecords()
    return () => controller.abort()
  }, [endpoint, filters, page, reloadKey, responseKey])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setFilters({
      q: draftFilters.q.trim(),
      from: draftFilters.from,
      to: draftFilters.to,
      status: draftFilters.status,
    })
  }

  function resetFilters() {
    setDraftFilters(initialFilters)
    setFilters(initialFilters)
    setPage(1)
  }

  return (
    <section aria-busy={state === 'loading'} className="grid gap-5">
      <form
        className="grid gap-4 rounded-2xl border border-borderSoft bg-white p-5 shadow-soft"
        onSubmit={applyFilters}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold text-textDark">
            {searchLabel}
            <input
              className="focus-ring min-w-0 rounded-lg border border-borderSoft px-3 py-2.5 font-normal"
              maxLength={100}
              onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
              type="search"
              value={draftFilters.q}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-textDark">
            開始日期
            <input
              className="focus-ring min-w-0 rounded-lg border border-borderSoft px-3 py-2.5 font-normal"
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
              type="date"
              value={draftFilters.from}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-textDark">
            結束日期
            <input
              className="focus-ring min-w-0 rounded-lg border border-borderSoft px-3 py-2.5 font-normal"
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
              type="date"
              value={draftFilters.to}
            />
          </label>
          {statusOptions.length > 0 ? (
            <label className="grid gap-2 text-sm font-semibold text-textDark">
              狀態
              <select
                className="focus-ring min-w-0 rounded-lg border border-borderSoft bg-white px-3 py-2.5 font-normal"
                onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
                value={draftFilters.status}
              >
                <option value="">全部狀態</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="focus-ring rounded-lg bg-deepPurple px-5 py-2.5 font-semibold text-white" type="submit">
            套用篩選
          </button>
          <button
            className="focus-ring rounded-lg border border-borderSoft bg-white px-5 py-2.5 font-semibold text-deepPurple"
            onClick={resetFilters}
            type="button"
          >
            清除條件
          </button>
        </div>
      </form>

      {state === 'loading' ? <AdminDataState state="loading" /> : null}
      {state === 'unauthorized' ? <AdminDataState state="unauthorized" /> : null}
      {state === 'error' ? (
        <AdminDataState
          message={errorMessage}
          onRetry={() => setReloadKey((value) => value + 1)}
          state="error"
        />
      ) : null}
      {state === 'empty' ? <AdminDataState message={emptyMessage} state="empty" /> : null}

      {state === 'ready' ? (
        <>
          <div data-mobile-admin-records className="grid gap-4 lg:hidden">
            {records.map((record) => (
              <article className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft" key={record.id}>
                {renderMobile(record)}
                <Link
                  className="focus-ring mt-4 inline-flex rounded-lg border border-borderSoft px-4 py-2 text-sm font-semibold text-deepPurple"
                  href={`${detailBasePath}/${record.id}`}
                >
                  查看詳情
                </Link>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-borderSoft bg-white shadow-soft lg:block">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-softPurple text-sm text-deepPurple">
                <tr>
                  {columns.map((column) => (
                    <th className="px-4 py-3 font-semibold" key={column.key} scope="col">{column.label}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold" scope="col">詳情</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr className="border-t border-borderSoft align-top" key={record.id}>
                    {columns.map((column) => (
                      <td className="px-4 py-4 text-sm leading-6 text-textDark" key={column.key}>
                        {column.render(record)}
                      </td>
                    ))}
                    <td className="px-4 py-4">
                      <Link
                        className="focus-ring rounded-lg text-sm font-semibold text-deepPurple underline decoration-darkGold underline-offset-4"
                        href={`${detailBasePath}/${record.id}`}
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination
            onPageChange={(nextPage) => {
              setPage(nextPage)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            page={meta.page}
            total={meta.total}
            totalPages={meta.totalPages}
          />
        </>
      ) : null}
    </section>
  )
}
