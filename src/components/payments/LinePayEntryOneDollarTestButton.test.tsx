import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { LinePayEntryOneDollarTestButton } from './LinePayEntryOneDollarTestButton'

const hiddenMarkup = renderToStaticMarkup(
  <LinePayEntryOneDollarTestButton
    available={false}
    disabled={false}
    onClick={() => {}}
  />,
)
assert.equal(hiddenMarkup, '')

const markup = renderToStaticMarkup(
  <LinePayEntryOneDollarTestButton
    available
    disabled={false}
    onClick={() => {}}
  />,
)
assert.match(markup, /管理員 LINE Pay 入口驗收 NT\$1/)
assert.match(markup, /type="button"/)
assert.doesNotMatch(markup, /disabled=""/)

const disabledMarkup = renderToStaticMarkup(
  <LinePayEntryOneDollarTestButton
    available
    disabled
    onClick={() => {}}
  />,
)
assert.match(disabledMarkup, /disabled=""/)

console.log('LINE Pay entry NT$1 button contract passed')
