type AdminDataStateProps = {
  state: 'loading' | 'empty' | 'error' | 'unauthorized' | 'unavailable'
  title?: string
  message?: string
  onRetry?: () => void
}

const defaults = {
  loading: ['正在讀取資料', '請稍候，資料不會儲存在瀏覽器。'],
  empty: ['目前沒有紀錄', '可以調整搜尋或日期條件後再試一次。'],
  error: ['暫時無法讀取', '請稍後重試；若持續發生，請聯繫網站管理者。'],
  unauthorized: ['沒有管理權限', '管理員權限由後台守門重新驗證。'],
  unavailable: ['尚未啟用', '此模組目前只保留狀態說明。'],
} as const

export default function AdminDataState({
  state,
  title,
  message,
  onRetry,
}: AdminDataStateProps) {
  const [defaultTitle, defaultMessage] = defaults[state]

  return (
    <div
      aria-live={state === 'loading' ? 'polite' : 'assertive'}
      className="rounded-2xl border border-borderSoft bg-white p-8 text-center shadow-soft"
      role={state === 'error' ? 'alert' : 'status'}
    >
      <h2 className="font-serifTC text-xl font-semibold text-deepPurple">{title ?? defaultTitle}</h2>
      <p className="mt-2 leading-7 text-textMuted">{message ?? defaultMessage}</p>
      {state === 'error' && onRetry ? (
        <button
          className="focus-ring mt-5 rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white"
          onClick={onRetry}
          type="button"
        >
          重新讀取
        </button>
      ) : null}
    </div>
  )
}
