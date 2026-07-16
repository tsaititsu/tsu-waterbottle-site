import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC_BUSINESS_INFO } from '../lib/publicBusinessInfo'

const root = process.cwd()
const serialized = JSON.stringify(PUBLIC_BUSINESS_INFO)

assert.equal(PUBLIC_BUSINESS_INFO.serviceAddressLabel, '雲林縣斗六市鎮南里中山路266巷3號')
assert.equal(PUBLIC_BUSINESS_INFO.appointmentOnlyLabel, '實體服務採預約制，不接受未預約來訪。')
assert.equal(PUBLIC_BUSINESS_INFO.appointmentHoursLabel, '每日 09:00–22:00')
assert.equal(PUBLIC_BUSINESS_INFO.customerServiceHoursLabel, '每日 09:00–18:00')
assert.equal(PUBLIC_BUSINESS_INFO.registrationAddress, '彰化縣田尾鄉饒平村東平巷167號1樓')
assert.equal(
  PUBLIC_BUSINESS_INFO.registrationAddressNote,
  '此地址僅為商業登記地址，不提供現場服務或來訪。',
)

for (const forbiddenField of [
  'telephone',
  'postalCode',
  'priceRange',
  'aggregateRating',
  'review',
  'reviewCount',
]) {
  assert.equal(serialized.includes(forbiddenField), false)
}

const contactPage = readFileSync(join(root, 'src/app/contact/page.tsx'), 'utf8')
assert.ok(contactPage.includes('實體預約服務地點'))
assert.ok(contactPage.includes('實體預約時段'))
assert.ok(contactPage.includes('來訪方式'))
assert.ok(contactPage.includes('在 Google Maps 查看'))
assert.ok(contactPage.includes('商業登記地址（非實體服務地點）'))
assert.ok(contactPage.includes('target="_blank"'))
assert.ok(contactPage.includes('rel="noopener noreferrer"'))

const footer = readFileSync(join(root, 'src/components/Footer.tsx'), 'utf8')
assert.ok(footer.includes('實體服務地點'))
assert.ok(footer.includes('實體預約時段'))
assert.ok(footer.includes('商業登記地址（非實體服務地點）'))
assert.equal(footer.includes('商業登記地址：彰化縣'), false)

const terms = readFileSync(join(root, 'src/app/terms/page.tsx'), 'utf8')
assert.ok(terms.includes("title: '實體預約服務'"))
assert.ok(terms.includes('商業登記地址（非實體服務地點）'))
assert.ok(terms.includes('registrationAddressNote'))

console.log('public business info tests passed')
