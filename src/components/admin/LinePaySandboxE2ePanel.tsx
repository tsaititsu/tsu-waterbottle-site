'use client'

import { useRef, useState } from 'react'
import { getAuthAccessToken } from '@/lib/mockAuth'
import {
  createLinePayProductionOneDollarAdminController,
  createLinePaySandboxE2eAdminController,
  type LinePaySandboxE2eAdminController,
  type LinePaySandboxE2eAdminSnapshot,
} from '@/lib/linePay/sandboxE2eAdminClient'

const CONFIRMATION_ID = 'line-pay-sandbox-e2e-confirmation'

export function linePayOneDollarSnapshotMessage(
  snapshot: LinePaySandboxE2eAdminSnapshot | null,
  environment: 'sandbox' | 'production',
) {
  if (!snapshot) return '尚未啟動測試。'
  if (snapshot.state === 'starting') {
    return environment === 'sandbox'
      ? '正在建立一次性 Sandbox 測試訂單，請勿關閉或重複操作。'
      : '正在建立一次性 Production NT$1 測試訂單，請勿關閉或重複操作。'
  }
  if (snapshot.state === 'redirecting') {
    return environment === 'sandbox'
      ? '正在前往 LINE Pay Sandbox，付款核准由管理員本人操作。'
      : '正在前往 LINE Pay 正式付款頁，將由管理員本人核准真實 NT$1 扣款。'
  }
  if (snapshot.diagnostic) {
    const environmentLabel = environment === 'sandbox' ? 'Sandbox' : 'Production'
    const stoppedMessage = environment === 'sandbox'
      ? '尚未送往 LINE Pay，且不會自動重試。'
      : '尚未送出真實扣款，且不會自動重試。'

    if (snapshot.diagnostic.stage === 'config') {
      return `${environmentLabel} 設定檢查失敗（階段：config）；${stoppedMessage}`
    }
    if (snapshot.diagnostic.stage === 'initialization') {
      const reason = snapshot.diagnostic.reason ?? 'initialization'
      return `${environmentLabel} 訂單初始化失敗（原因：${reason}）；${stoppedMessage}`
    }
    if (snapshot.diagnostic.stage === 'execution') {
      if (snapshot.diagnostic.reason === 'provider_rejected') {
        return `${environmentLabel} LINE Pay 拒絕付款請求（原因：provider_rejected）；${stoppedMessage}`
      }
      if (snapshot.diagnostic.reason === 'gateway_request_failed') {
        return `${environmentLabel} Gateway 已回應，但拒絕或無法完成請求（原因：gateway_request_failed）；${environment === 'sandbox' ? '尚未取得付款網址，且不會自動重試。' : stoppedMessage}`
      }
      if (snapshot.diagnostic.reason) {
        return `${environmentLabel} Gateway／LINE Pay 請求失敗（原因：${snapshot.diagnostic.reason}）；${environment === 'sandbox' ? '尚未取得付款網址，且不會自動重試。' : stoppedMessage}`
      }
      return `${environmentLabel} Gateway／LINE Pay 請求失敗（階段：execution）；${environment === 'sandbox' ? '尚未取得付款網址，且不會自動重試。' : stoppedMessage}`
    }
    if (snapshot.diagnostic.stage === 'not_ready') {
      return `${environmentLabel} 付款請求狀態未就緒（階段：not_ready）；${stoppedMessage}`
    }
    return `${environmentLabel} 付款網址處理失敗（階段：payment_url）；${stoppedMessage}`
  }
  if (snapshot.error === 'admin_session_unavailable') {
    return environment === 'sandbox'
      ? '管理員登入 Session 無法使用，尚未送出 Sandbox 測試。請重新登入後重新載入頁面。'
      : '管理員登入 Session 無法使用，尚未送出 Production 測試。請重新登入後重新載入頁面。'
  }
  if (snapshot.error === 'invalid_sandbox_payment_url') {
    return '付款網址未通過 Sandbox 安全驗證，已停止導向且不會重試。'
  }
  if (snapshot.error === 'invalid_production_payment_url') {
    return '付款網址未通過 LINE Pay Production 安全驗證，已停止導向且不會重試。'
  }
  if (snapshot.error === 'sandbox_response_invalid') {
    return 'Sandbox 回應格式不符合安全契約，已停止且不會重試。'
  }
  if (snapshot.error === 'production_response_invalid') {
    return 'Production 回應格式不符合安全契約，已停止且不會重試。'
  }
  return environment === 'sandbox'
    ? 'Sandbox 測試未完成；為避免重複付款，本頁不會自動重試。'
    : 'Production 測試未完成；為避免重複扣款，本頁不會自動重試。'
}

export default function LinePaySandboxE2ePanel({
  environment,
}: {
  environment: 'sandbox' | 'production'
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [snapshot, setSnapshot] = useState<LinePaySandboxE2eAdminSnapshot | null>(null)
  const controllerRef = useRef<LinePaySandboxE2eAdminController | null>(null)

  if (controllerRef.current == null) {
    const createController = environment === 'sandbox'
      ? createLinePaySandboxE2eAdminController
      : createLinePayProductionOneDollarAdminController
    controllerRef.current = createController(
      {
        getAccessToken: getAuthAccessToken,
        fetchStart: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
        navigate: (url) => window.location.assign(url),
      },
      setSnapshot,
    )
  }

  const locked = snapshot !== null

  return (
    <section
      aria-labelledby="line-pay-sandbox-e2e-title"
      className="rounded-2xl border border-[#d9b85f] bg-[#fffaf0] p-5 shadow-soft md:p-6"
      data-line-pay-sandbox-e2e-panel
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-[#7d5a00]">
            {environment === 'sandbox' ? 'Preview 專用' : '正式站限定'}
          </p>
          <h2
            className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple"
            id="line-pay-sandbox-e2e-title"
          >
            {environment === 'sandbox'
              ? 'LINE Pay Sandbox E2E'
              : 'LINE Pay Production NT$1'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-textMuted">
            {environment === 'sandbox' ? (
              <>
                建立一筆 NT$1 測試訂單，只使用 Sandbox Supabase、固定出口 Gateway 與 LINE Pay Sandbox。
                此工具不會接觸正式資料，也不會啟用 Production LINE Pay。
              </>
            ) : (
              <>
                建立一筆固定 NT$1 的正式測試訂單，會進入 LINE Pay Production 並真實扣款 NT$1。
                訂單與商品皆標示為內部測試，不會出貨。
              </>
            )}
          </p>
        </div>
        <span className="rounded-full border border-[#d9b85f] bg-white px-3 py-1 text-xs font-semibold text-[#7d5a00]">
          {environment === 'sandbox' ? 'Sandbox only' : 'Production · 真實扣款'}
        </span>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#ead9a6] bg-white p-4 text-sm leading-6 text-textDark" htmlFor={CONFIRMATION_ID}>
        <input
          checked={confirmed}
          className="mt-1 size-4 accent-[#7d5a00]"
          disabled={locked}
          id={CONFIRMATION_ID}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>
          {environment === 'sandbox'
            ? '我確認這是一次 NT$1 LINE Pay Sandbox 測試，付款核准畫面由我本人操作。'
            : '我確認這是一次 LINE Pay Production 真實扣款 NT$1 測試，且測試訂單不會出貨。'}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="focus-ring rounded-lg bg-[#7d5a00] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!confirmed || locked}
          onClick={() => {
            if (!confirmed || locked) return
            void controllerRef.current?.start()
          }}
        >
          {snapshot?.state === 'starting'
            ? environment === 'sandbox'
              ? '正在建立 Sandbox 測試...'
              : '正在建立正式 NT$1 測試...'
            : snapshot?.state === 'redirecting'
              ? environment === 'sandbox'
                ? '正在前往 LINE Pay Sandbox...'
                : '正在前往 LINE Pay 正式付款頁...'
              : environment === 'sandbox'
                ? '執行一次 NT$1 Sandbox 測試'
                : '執行一次正式 NT$1 測試'}
        </button>
        <p aria-live="polite" className="text-sm leading-6 text-textMuted" role="status">
          {linePayOneDollarSnapshotMessage(snapshot, environment)}
        </p>
      </div>
    </section>
  )
}
