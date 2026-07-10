import Link from 'next/link'
import { getDivinationReadingAction } from './getDivinationReadingAction'

type DivinationReadingActionProps = {
  readingId: string
  status: string | null
}

export function DivinationReadingAction({ readingId, status }: DivinationReadingActionProps) {
  const action = getDivinationReadingAction(readingId, status)

  if (action) {
    return (
      <Link
        className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-deepPurple px-4 py-3 text-center text-sm font-semibold text-white sm:w-fit"
        href={action.href}
      >
        {action.label}
      </Link>
    )
  }

  if (status === 'pending_payment') {
    return <p className="text-sm text-textMuted">尚未完成付款。</p>
  }

  if (status === 'failed') {
    return (
      <p className="text-sm leading-6 text-textMuted">
        解讀暫時未完成，請聯繫客服協助。這筆付款已完成時，請勿再次付款。
      </p>
    )
  }

  return null
}
