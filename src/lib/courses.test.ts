import assert from 'node:assert/strict'
import { courseCatalog, isCourseSalesOpen } from './courses'

assert.equal(isCourseSalesOpen(undefined), false)
assert.equal(isCourseSalesOpen(''), false)
assert.equal(isCourseSalesOpen('false'), false)
assert.equal(isCourseSalesOpen('0'), false)
assert.equal(isCourseSalesOpen('TRUE'), false)
assert.equal(isCourseSalesOpen('true'), true)

assert.equal(courseCatalog.length, 3)
assert.deepEqual(
  courseCatalog.map((course) => course.price),
  [9800, 9800, 9800],
)
