import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const bookingFormSource = readFileSync(join(root, 'src/components/BookingForm.tsx'), 'utf8')
const floatingLineSource = readFileSync(join(root, 'src/components/FloatingLineButton.tsx'), 'utf8')
const globalCssSource = readFileSync(join(root, 'src/app/globals.css'), 'utf8')
const bankTransferReminderError = '請先勾選確認已了解郵局匯款後的聯絡與預約確認流程。'

// 郵局匯款提醒預設未勾選，完整 reset 也必須清回 false；它與服務條款是兩個獨立狀態。
assert.equal(
  bookingFormSource.includes(
    'const [hasAcceptedBankTransferReminder, setHasAcceptedBankTransferReminder] = useState(false)',
  ),
  true,
)
assert.equal(bookingFormSource.includes('setHasAcceptedBankTransferReminder(false)'), true)
assert.equal(bookingFormSource.includes('const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false)'), true)

// 只有郵局匯款需要這個額外確認；信用卡不可被它阻擋。
assert.equal(bookingFormSource.includes(`const BANK_TRANSFER_REMINDER_ERROR = '${bankTransferReminderError}'`), true)
assert.equal(
  bookingFormSource.includes(
    "return paymentMethod === 'bank-transfer' && !hasAcceptedReminder ? BANK_TRANSFER_REMINDER_ERROR : ''",
  ),
  true,
)

// Guard 必須位於任何建立預約或匯款回報 POST 之前，未勾選時直接 return false。
const reminderGuardIndex = bookingFormSource.indexOf(
  'const bankTransferReminderError = getBankTransferReminderError(paymentMethod, hasAcceptedBankTransferReminder)',
)
const bookingCreateIndex = bookingFormSource.indexOf("fetch('/api/bookings/create'")
const bankTransferSubmitIndex = bookingFormSource.indexOf("fetch('/api/bank-transfer/submit'")
assert.equal(reminderGuardIndex >= 0, true)
assert.equal(reminderGuardIndex < bookingCreateIndex, true)
assert.equal(reminderGuardIndex < bankTransferSubmitIndex, true)
assert.equal(
  bookingFormSource.includes(
    `if (bankTransferReminderError) {\n        setFormError(bankTransferReminderError)\n        return false\n      }`,
  ),
  true,
)

// LINE 連結固定為正式入口，且提醒錯誤顯示在該確認框附近。
assert.equal(bookingFormSource.includes("const officialLineUrl = 'https://lin.ee/6Tpje1P'"), true)
assert.equal(bookingFormSource.includes('formError === BANK_TRANSFER_REMINDER_ERROR'), true)
assert.equal(bookingFormSource.includes('id="booking-bank-transfer-reminder"'), true)
assert.equal(bookingFormSource.includes('id="booking-terms-consent"'), true)

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

console.log('✓ booking mobile input and consent UX contracts passed')
