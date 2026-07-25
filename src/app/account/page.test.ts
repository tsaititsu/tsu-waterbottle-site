import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const accountPage = readFileSync(join(root, 'src/app/account/page.tsx'), 'utf8')
const mockPayment = readFileSync(join(root, 'src/lib/mockPayment.ts'), 'utf8')
const mockPaymentExports = [...mockPayment.matchAll(/export function (\w+)/g)].map((match) => match[1]).sort()

assert.equal(accountPage.includes('getPaymentRecords'), false)
assert.equal(accountPage.includes('PaymentRecord'), false)
assert.equal(accountPage.includes('waterbottle_mock_payments'), false)
assert.equal(accountPage.includes('完成 mock 付款後會顯示在這裡'), false)
assert.equal(accountPage.includes('>付款紀錄</h2>'), false)
assert.equal(accountPage.includes('payment.itemName'), false)
assert.equal(accountPage.includes('payment.amount'), false)
assert.equal(accountPage.includes("if (stat.title === '付款紀錄') return false"), true)

assert.equal(accountPage.includes('個人資料'), true)
assert.equal(accountPage.includes('href="/account/courses"'), true)
assert.equal(accountPage.includes('href="/account/divinations"'), true)
assert.equal(accountPage.includes('<LoginModal'), true)

assert.equal(mockPayment.includes('export type PaymentRecord'), false)
assert.equal(mockPayment.includes('getPaymentRecords'), false)
assert.equal(mockPayment.includes('waterbottle_mock_payments'), false)

assert.equal(mockPayment.includes('export type'), false)
assert.deepEqual(mockPaymentExports, ['hasJoinedWaitlist', 'joinCourseWaitlist'])
assert.equal(mockPayment.includes('joinCourseWaitlist'), true)
assert.equal(mockPayment.includes('hasJoinedWaitlist'), true)
assert.equal(mockPayment.includes('waterbottle_course_waitlist'), true)
assert.equal(mockPayment.includes('user.id'), false)
assert.equal(mockPayment.includes('JSON.stringify'), false)

console.log('✓ account no longer renders local mock payment history')
