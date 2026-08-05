import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { getCheckoutPaymentMethodOptions } from '@/lib/payments/paymentMethods'
import { PaymentMethodSelector } from './PaymentMethodSelector'

const markup = renderToStaticMarkup(
  <PaymentMethodSelector
    onChange={() => undefined}
    options={getCheckoutPaymentMethodOptions()}
    value="line_pay"
  />,
)

assert.equal(markup.includes('<select'), true, '付款方式應使用單一選單')
assert.equal(markup.includes('type="radio"'), false, '不應再顯示大型 radio 卡片')
assert.equal(markup.includes('信用卡一次付清'), true)
assert.equal(markup.includes('Apple Pay'), true)
assert.equal(markup.includes('LINE Pay'), true)
assert.equal(markup.includes('ATM 虛擬帳號'), true)
assert.equal(markup.includes('value="line_pay" selected=""'), true)
assert.equal(
  markup.includes('使用本站獨立串接的 LINE Pay 安全付款頁。'),
  true,
  '選單下方應說明目前選取的付款方式',
)

const disabledMarkup = renderToStaticMarkup(
  <PaymentMethodSelector
    disabled
    onChange={() => undefined}
    options={getCheckoutPaymentMethodOptions({ includeLinePay: false })}
    value="credit_card"
  />,
)

assert.equal(disabledMarkup.includes('<select'), true)
assert.equal(disabledMarkup.includes('disabled=""'), true)
assert.equal(disabledMarkup.includes('LINE Pay'), false)

console.log('付款方式下拉選單公開介面測試通過')
