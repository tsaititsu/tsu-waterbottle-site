import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const bookingFormSource = readFileSync(join(root, 'src/components/BookingForm.tsx'), 'utf8')
const bookingPageSource = readFileSync(join(root, 'src/app/booking/page.tsx'), 'utf8')
const floatingLineSource = readFileSync(join(root, 'src/components/FloatingLineButton.tsx'), 'utf8')
const globalCssSource = readFileSync(join(root, 'src/app/globals.css'), 'utf8')

for (const retiredContract of [
  'bank-transfer',
  'bankAccountLast5',
  'BANK_TRANSFER_REMINDER_ERROR',
  '/api/bank-transfer/submit',
  '/bank-transfer/submit',
  ['008', '1359', '014', '6512'].join(''),
  ['008', '1359'].join(''),
  ['014', '6512'].join(''),
  '郵局匯款',
  '選擇付款方式',
]) {
  assert.equal(bookingFormSource.includes(retiredContract), false, retiredContract)
}

assert.equal(bookingFormSource.includes('信用卡線上付款｜藍新金流'), true)
assert.equal(
  bookingFormSource.includes(
    '送出後先建立預約，再前往藍新金流信用卡一次付清頁；付款狀態以金流背景通知為準。',
  ),
  true,
)
assert.equal(bookingFormSource.includes("paymentMode: 'credit'"), true)
assert.equal(bookingFormSource.includes("itemKey: 'booking_consultation_60'"), true)
assert.equal(bookingFormSource.includes("source: 'booking'"), true)
assert.equal(bookingFormSource.includes('前往信用卡付款 NT$'), true)
assert.equal(
  bookingFormSource.includes('預約已建立，但付款頁建立失敗。請稍後重試；如仍無法付款，請聯繫客服，勿重複建立預約。'),
  true,
)

// NewebPay disabled 必須在任何建立預約 POST 前 fail closed。
const newebPayGuardIndex = bookingFormSource.indexOf('if (!isNewebPayEnabled) {')
const bookingCreateIndex = bookingFormSource.indexOf("fetch('/api/bookings/create'")
assert.equal(newebPayGuardIndex >= 0, true)
assert.equal(bookingCreateIndex >= 0, true)
assert.equal(newebPayGuardIndex < bookingCreateIndex, true)
assert.equal(
  bookingFormSource.includes(
    "if (!isNewebPayEnabled) {\n      setFormError('目前暫時無法使用線上付款，請稍後再試或聯繫客服。')\n      return false\n    }",
  ),
  true,
)

// 原有預約頁殼、日期控制與真人論命服務條款確認仍保留。
assert.equal(bookingPageSource.includes("import { BookingPageShell }"), true)
assert.equal(bookingPageSource.includes('<BookingPageShell />'), true)
assert.equal(bookingFormSource.includes("const officialLineUrl = 'https://lin.ee/6Tpje1P'"), true)
assert.equal(bookingFormSource.includes('id="booking-terms-consent"'), true)
assert.equal(bookingFormSource.includes('const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false)'), true)
assert.equal(bookingFormSource.includes('完成付款後，將由客服協助確認預約資訊與後續安排。'), true)

// 出生日期仍拆成年、月、日，月份與日期不強制保留前導零。
assert.equal(bookingFormSource.includes("const [year, month, day] = value.split('-')"), true)
assert.equal(bookingFormSource.includes("month: month ? String(Number(month)) : ''"), true)
assert.equal(bookingFormSource.includes("day: day ? String(Number(day)) : ''"), true)

// 兩個日期控制項都由真實 native date input 覆蓋可見區域，不依賴 showPicker/click workaround。
assert.equal(bookingFormSource.includes('showPicker'), false)
assert.equal(bookingFormSource.includes('birthDateInputRef'), false)
assert.equal(bookingFormSource.includes('aria-label="選擇預約日期"'), true)
assert.equal(bookingFormSource.includes('aria-label="選擇出生年月日"'), true)
assert.equal(
  bookingFormSource.split('className="focus-ring absolute inset-0 h-full w-full cursor-pointer opacity-0').length - 1,
  2,
)

// 預約日期變更仍同時更新日期與該日第一個可用時段。
const updateDateStart = bookingFormSource.indexOf('const updateSelectedBookingDate = (dateValue: string) => {')
const updateDateEnd = bookingFormSource.indexOf('\n  }', updateDateStart)
const updateDateSource = bookingFormSource.slice(updateDateStart, updateDateEnd)
assert.equal(updateDateSource.includes('setSelectedBookingDate(dateValue)'), true)
assert.equal(updateDateSource.includes('setSelectedSlotId(firstSlot?.id ?? \'\')'), true)

// 手機觸控尺寸與浮動 LINE 位置維持在指定範圍；桌面尺寸仍為 64px。
assert.equal(floatingLineSource.includes('h-12 w-12'), true)
assert.equal(floatingLineSource.includes('md:h-16 md:w-16'), true)
assert.equal(globalCssSource.includes('right: 14px;'), true)
assert.equal(globalCssSource.includes('+ 12px'), true)

console.log('✓ booking credit-only payment, mobile input, and consent contracts passed')
