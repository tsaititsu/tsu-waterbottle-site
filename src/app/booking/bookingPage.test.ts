import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const bookingPagePath = join(root, 'src/app/booking/page.tsx')
const bookingPageSource = readFileSync(bookingPagePath, 'utf8')
const removedCartPromptComponent = ['AddConsultation', 'ToCartButton'].join('')

// 預約頁只保留正式表單，不再提供論命服務的購物車預覽入口。
assert.equal(bookingPageSource.includes(removedCartPromptComponent), false)
assert.equal(bookingPageSource.includes('論命預約付款前'), false)
assert.equal(bookingPageSource.includes('若先預覽購物流程'), false)
assert.equal(
  existsSync(join(root, `src/components/${removedCartPromptComponent}.tsx`)),
  false,
)

// 預約頁原有 metadata、Service JSON-LD、可見性 redirect 與正式表單殼層都必須保留。
assert.equal(bookingPageSource.includes('export const metadata: Metadata'), true)
assert.equal(bookingPageSource.includes('createPublicMetadata(PUBLIC_PAGE_METADATA.booking)'), true)
assert.equal(bookingPageSource.includes('BOOKING_SERVICE_JSON_LD'), true)
assert.equal(bookingPageSource.includes('booking-service-structured-data'), true)
assert.equal(bookingPageSource.includes('<PageHero'), true)
assert.equal(bookingPageSource.includes('shouldHideConsultationServices()'), true)
assert.equal(bookingPageSource.includes("redirect('/')"), true)
assert.equal(bookingPageSource.includes('<BookingPageShell />'), true)

// 本次只移除預約頁入口；全站購物車核心仍存在。
for (const cartCorePath of [
  'src/components/CartContext.tsx',
  'src/components/Header.tsx',
  'src/app/cart/page.tsx',
]) {
  assert.equal(existsSync(join(root, cartCorePath)), true, `${cartCorePath} must remain`)
}

console.log('✓ booking page cart preview removal contracts passed')
