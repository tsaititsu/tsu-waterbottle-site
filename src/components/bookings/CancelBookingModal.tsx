'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CANCELLATION_REASON_MAX_LENGTH, validateCancellationReason } from './cancellationReason'

export type CancelBookingSummary = {
  date: string
  time: string
  service: string
}

type CancelBookingModalProps = {
  open: boolean
  bookingId?: string
  summary?: CancelBookingSummary
  loading: boolean
  error?: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
}

const focusableSelector = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function CancelBookingModal({
  open,
  bookingId,
  summary,
  loading,
  error = '',
  onClose,
  onConfirm,
}: CancelBookingModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const reasonErrorId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => textareaRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousBodyOverflow
      previousFocusRef.current?.focus()
    }
  }, [bookingId, open])

  useEffect(() => {
    if (!open) return

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!loading) onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      ).filter((element) => element.offsetParent !== null)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [loading, onClose, open])

  if (!open || !bookingId || !summary || typeof document === 'undefined') return null

  const reasonTooLong = reason.length > CANCELLATION_REASON_MAX_LENGTH
  const visibleError = validationError || error

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const validation = validateCancellationReason(reason)
    if (validation.error) {
      setValidationError(validation.error)
      textareaRef.current?.focus()
      return
    }

    setValidationError('')
    await onConfirm(validation.reason)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-textDark/45 px-4 py-4 backdrop-blur-sm sm:items-center"
      data-testid="cancel-booking-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose()
      }}
    >
      <div
        ref={dialogRef}
        aria-busy={loading}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg overflow-y-auto overscroll-contain rounded-lg bg-white p-5 shadow-2xl sm:p-6"
        data-testid="cancel-booking-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        style={{
          maxHeight: '90dvh',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
        }}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple" id={titleId}>
              取消預約
            </h2>
            <p className="mt-2 text-sm leading-6 text-textMuted" id={descriptionId}>
              請確認是否取消本次預約。
            </p>
          </div>
          <button
            aria-label="關閉取消預約視窗"
            className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-lg text-textMuted transition hover:bg-softPurple disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <dl className="mt-5 grid gap-3 rounded-lg border border-borderSoft bg-softPurple p-4 text-sm">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="font-semibold text-textMuted">預約日期</dt>
            <dd className="min-w-0 font-semibold text-textDark">{summary.date}</dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="font-semibold text-textMuted">預約時間</dt>
            <dd className="min-w-0 font-semibold text-textDark">{summary.time}</dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="font-semibold text-textMuted">服務項目</dt>
            <dd className="min-w-0 break-words font-semibold text-textDark">{summary.service}</dd>
          </div>
        </dl>

        <form className="mt-5" onSubmit={handleSubmit}>
          <div className="flex items-end justify-between gap-3">
            <label className="font-semibold text-textDark" htmlFor={`${bookingId}-cancellation-reason`}>
              取消原因
            </label>
            <span className={`text-xs ${reasonTooLong ? 'font-semibold text-red-700' : 'text-textMuted'}`}>
              {reason.length}/{CANCELLATION_REASON_MAX_LENGTH}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            aria-describedby={visibleError ? reasonErrorId : undefined}
            aria-invalid={Boolean(visibleError)}
            className="focus-ring mt-2 min-h-32 w-full resize-y rounded-lg border border-borderSoft bg-white px-4 py-3 text-base leading-6 text-textDark placeholder:text-textMuted/70 disabled:cursor-not-allowed disabled:bg-gray-50"
            data-testid="cancellation-reason"
            disabled={loading}
            id={`${bookingId}-cancellation-reason`}
            onChange={(event) => {
              setReason(event.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder="請簡要說明取消原因"
            value={reason}
          />
          {visibleError ? (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" id={reasonErrorId} role="alert">
              {visibleError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="focus-ring min-h-11 rounded-lg border border-borderSoft bg-white px-4 py-3 font-semibold text-deepPurple transition hover:bg-softPurple disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              onClick={onClose}
              type="button"
            >
              返回
            </button>
            <button
              className="focus-ring min-h-11 rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              data-testid="confirm-cancel-booking"
              type="submit"
            >
              {loading ? '取消中...' : '確認取消預約'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
