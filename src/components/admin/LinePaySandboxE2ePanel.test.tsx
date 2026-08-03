import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LinePaySandboxE2ePanel from './LinePaySandboxE2ePanel'

const markup = renderToStaticMarkup(createElement(LinePaySandboxE2ePanel))

assert.match(markup, /LINE Pay Sandbox E2E/)
assert.match(markup, /Preview 專用/)
assert.match(markup, /NT\$50/)
assert.match(markup, /只使用 Sandbox/)
assert.match(markup, /不會啟用 Production LINE Pay/)
assert.match(markup, /type="checkbox"/)
assert.match(markup, /type="button"[^>]*disabled=""/)
assert.match(markup, /執行一次 NT\$50 Sandbox 測試/)
assert.match(markup, /aria-live="polite"/)

console.log('✓ LINE Pay Sandbox E2E admin panel initial-state contract passed')
