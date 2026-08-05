import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/courses/courses-client.tsx'), 'utf8')
const homeData = readFileSync(join(process.cwd(), 'src/lib/mockData.ts'), 'utf8')

assert.match(source, /const salesOpen = isCourseSalesOpen\(\)/)
assert.match(source, /!salesOpen && !purchased/)
assert.match(source, /即將開課/)
assert.match(source, /加入官方 LINE，開課第一時間通知你/)
assert.match(source, /href="https:\/\/lin\.ee\/6Tpje1P"/)
assert.match(source, /salesOpen \? \(\s*<div className="mb-4">\s*<CoursePurchaseNotice/)
assert.match(source, /登入並購買/)
assert.doesNotMatch(source, />\s*請先登入\s*</)
assert.match(homeData, /title: '紫微斗數課程'[\s\S]*badge: '即將開課'/)
assert.match(source, /<PaymentMethodSelector/)
assert.match(source, /includeCourseInstallments: true/)
assert.match(source, /idempotencyKey: `course-line-pay:\$\{course\.id\}`/)
assert.doesNotMatch(source, /crypto\.randomUUID/)

const disabledBranch = source.slice(source.indexOf('{!salesOpen && !purchased'), source.indexOf(') : !user ? ('))
assert.doesNotMatch(disabledBranch, /CoursePurchaseNotice/)
assert.doesNotMatch(disabledBranch, /purchaseCourse/)
assert.doesNotMatch(disabledBranch, /立即購買/)
