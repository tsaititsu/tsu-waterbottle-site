import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LinePaySandboxE2ePanel, {
  linePayOneDollarSnapshotMessage,
} from './LinePaySandboxE2ePanel'

const markup = renderToStaticMarkup(
  createElement(LinePaySandboxE2ePanel, { environment: 'sandbox' }),
)

assert.match(markup, /LINE Pay Sandbox E2E/)
assert.match(markup, /Preview 專用/)
assert.match(markup, /NT\$1/)
assert.match(markup, /只使用 Sandbox/)
assert.match(markup, /不會啟用 Production LINE Pay/)
assert.match(markup, /type="checkbox"/)
assert.match(markup, /type="button"[^>]*disabled=""/)
assert.match(markup, /執行一次 NT\$1 Sandbox 測試/)
assert.match(markup, /aria-live="polite"/)

const productionMarkup = renderToStaticMarkup(
  createElement(LinePaySandboxE2ePanel, { environment: 'production' }),
)

assert.match(productionMarkup, /正式站限定/)
assert.match(productionMarkup, /LINE Pay Production NT\$1/)
assert.match(productionMarkup, /真實扣款 NT\$1/)
assert.match(productionMarkup, /不會出貨/)
assert.match(productionMarkup, /type="checkbox"/)
assert.match(productionMarkup, /執行一次正式 NT\$1 測試/)
assert.doesNotMatch(productionMarkup, /Sandbox only/)

assert.equal(
  linePayOneDollarSnapshotMessage(
    {
      state: 'failed',
      error: 'sandbox_request_failed',
      diagnostic: { stage: 'execution' },
    },
    'sandbox',
  ),
  'Sandbox Gateway／LINE Pay 請求失敗（階段：execution）；尚未取得付款網址，且不會自動重試。',
)
assert.equal(
  linePayOneDollarSnapshotMessage(
    {
      state: 'failed',
      error: 'sandbox_request_failed',
      diagnostic: {
        stage: 'execution',
        reason: 'gateway_request_failed',
      },
    },
    'sandbox',
  ),
  'Sandbox Gateway 已回應，但拒絕或無法完成請求（原因：gateway_request_failed）；尚未取得付款網址，且不會自動重試。',
)
assert.equal(
  linePayOneDollarSnapshotMessage(
    {
      state: 'failed',
      error: 'sandbox_request_failed',
      diagnostic: {
        stage: 'initialization',
        reason: 'rpc_insufficient_privilege',
      },
    },
    'sandbox',
  ),
  'Sandbox 訂單初始化失敗（原因：rpc_insufficient_privilege）；尚未送往 LINE Pay，且不會自動重試。',
)
assert.equal(
  linePayOneDollarSnapshotMessage(
    {
      state: 'failed',
      error: 'production_request_failed',
      diagnostic: { stage: 'config' },
    },
    'production',
  ),
  'Production 設定檢查失敗（階段：config）；尚未送出真實扣款，且不會自動重試。',
)

console.log('✓ LINE Pay Sandbox E2E admin panel initial-state contract passed')
