import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CANCELLATION_REASON_MAX_LENGTH,
  validateCancellationReason,
} from './cancellationReason'

const root = process.cwd()
const modal = readFileSync(join(root, 'src/components/bookings/CancelBookingModal.tsx'), 'utf8')
const bookingsPage = readFileSync(join(root, 'src/app/account/bookings/page.tsx'), 'utf8')
const bookingUpdateRoute = readFileSync(join(root, 'src/app/api/bookings/update/route.ts'), 'utf8')
const cancellationEmailRoute = readFileSync(
  join(root, 'src/app/api/email/send-booking-cancellation/route.ts'),
  'utf8'
)

assert.equal(CANCELLATION_REASON_MAX_LENGTH, 300)
assert.deepEqual(validateCancellationReason('   '), {
  reason: '',
  error: '請填寫取消原因。',
})
assert.deepEqual(validateCancellationReason('  行程臨時調整  '), {
  reason: '行程臨時調整',
  error: '',
})
assert.deepEqual(validateCancellationReason('字'.repeat(CANCELLATION_REASON_MAX_LENGTH + 1)), {
  reason: '字'.repeat(CANCELLATION_REASON_MAX_LENGTH + 1),
  error: '取消原因最多 300 字。',
})

// 使用中的會員預約頁必須以站內 Modal 取代瀏覽器 prompt / confirm。
assert.equal(bookingsPage.includes('window.prompt'), false)
assert.equal(bookingsPage.includes('window.confirm'), false)
assert.equal(bookingsPage.includes('<CancelBookingModal'), true)
assert.equal(bookingsPage.includes('onClick={() => openCancellationModal(booking)}'), true)
assert.equal(bookingsPage.includes('data-testid="open-cancel-booking"'), true)

// 先由後端確認取消狀態，前端不能宣告付款或外部副作用結果。
assert.equal(bookingsPage.includes("'/api/calendar/cancel-event'"), true)
assert.equal(bookingsPage.includes("'/api/email/send-booking-cancellation'"), true)
assert.equal(bookingsPage.includes("'/api/bookings/update'"), true)
assert.equal(bookingsPage.includes('cancellationReason: reason'), true)
assert.equal(bookingsPage.includes("status: 'cancelled'"), false)
assert.equal(bookingsPage.includes('eventId: booking.googleCalendarEventId'), false)
assert.equal(bookingsPage.includes('cancellationEmailSentToCustomer: emailsSent'), true)
assert.equal(bookingsPage.includes("booking.status === 'cancelled' ?"), true)
assert.equal(bookingUpdateRoute.includes('getSupabaseBookingForRequester'), true)
assert.equal(bookingUpdateRoute.includes('cancelSupabaseBooking'), true)
assert.equal(cancellationEmailRoute.includes("kind: 'cancellation'"), true)
assert.ok(
  bookingsPage.indexOf("'/api/bookings/update'") < bookingsPage.indexOf("'/api/calendar/cancel-event'"),
  '必須先取消 booking，才能執行 Calendar 與 Email 副作用',
)

// API 成功才關閉並更新列表；API 失敗保留 Modal 與輸入內容。
assert.equal(bookingsPage.includes('closeCancellationModal()'), true)
assert.equal(bookingsPage.includes('setCancellationError(\'取消預約失敗，請稍後再試；已輸入的取消原因會保留。\')'), true)
assert.equal(bookingsPage.includes('setBookings((current)'), true)

// Dialog 顯示摘要，並具備手機、safe area、loading 與無障礙行為。
assert.equal(modal.includes('預約日期'), true)
assert.equal(modal.includes('預約時間'), true)
assert.equal(modal.includes('服務項目'), true)
assert.equal(modal.includes('role="dialog"'), true)
assert.equal(modal.includes('aria-modal="true"'), true)
assert.equal(modal.includes('aria-labelledby={titleId}'), true)
assert.equal(modal.includes('aria-busy={loading}'), true)
assert.equal(modal.includes('aria-label="關閉取消預約視窗"'), true)
assert.equal(modal.includes("maxHeight: '90dvh'"), true)
assert.equal(modal.includes("env(safe-area-inset-bottom, 0px)"), true)
assert.equal(modal.includes('text-base'), true)
assert.equal(modal.includes('min-h-11'), true)

// Escape、背景、focus trap、focus restore 與 body scroll lock 都由 Modal 管理。
assert.equal(modal.includes("event.key === 'Escape'"), true)
assert.equal(modal.includes('event.target === event.currentTarget && !loading'), true)
assert.equal(modal.includes('onClick={(event) => event.stopPropagation()}'), true)
assert.equal(modal.includes("document.body.style.overflow = 'hidden'"), true)
assert.equal(modal.includes('document.body.style.overflow = previousBodyOverflow'), true)
assert.equal(modal.includes('previousFocusRef.current?.focus()'), true)
assert.equal(modal.includes("event.key !== 'Tab'"), true)

// loading 時所有關閉與送出入口均受控，避免重複取消。
assert.equal(modal.includes('if (!loading) onClose()'), true)
assert.equal(modal.includes('if (loading) return'), true)
assert.equal(modal.includes("{loading ? '取消中...' : '確認取消預約'}"), true)

console.log('✓ booking cancellation modal checks passed')
