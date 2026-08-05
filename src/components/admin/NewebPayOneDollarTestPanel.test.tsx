import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import NewebPayOneDollarTestPanel from './NewebPayOneDollarTestPanel'

const markup = renderToStaticMarkup(createElement(NewebPayOneDollarTestPanel))

assert.match(markup, /藍新金流管理員 NT\$1 測試/)
assert.match(markup, /信用卡一次付清 NT\$1/)
assert.match(markup, /Apple Pay NT\$1/)
assert.match(markup, /ATM 虛擬帳號 NT\$1/)
assert.match(markup, /每次只建立一筆測試付款/)
assert.match(markup, /不會開通課程、不會交付服務，也不會出貨/)
assert.match(markup, /type="checkbox"/)
assert.equal(
  markup.match(/<button(?=[^>]*type="button")(?=[^>]*disabled="")[^>]*>/g)?.length,
  3,
)
assert.doesNotMatch(markup, /分期|installment_3|installment_6/)
assert.doesNotMatch(markup, /MerchantID|TradeInfo|TradeSha|HashKey|HashIV/)

console.log('NewebPay 管理員三通道 NT$1 面板契約通過')
