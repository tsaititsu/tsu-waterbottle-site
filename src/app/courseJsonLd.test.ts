import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { courseCatalog } from '../lib/courses'
import { COURSE_LIST_JSON_LD } from '../lib/seo/courseJsonLd'
import { serializeJsonLd } from '../lib/seo/homepageJsonLd'

const root = process.cwd()
const coursesUrl = 'https://tsu-waterbottle.com/courses'
const organizationId = 'https://tsu-waterbottle.com/#organization'
const serialized = serializeJsonLd(COURSE_LIST_JSON_LD)
const parsed = JSON.parse(serialized) as typeof COURSE_LIST_JSON_LD

assert.equal(parsed['@context'], 'https://schema.org')
assert.equal(parsed['@type'], 'ItemList')
assert.equal(parsed['@id'], `${coursesUrl}#course-list`)
assert.equal(parsed.name, '紫微斗數三階段課程')
assert.equal(parsed.url, coursesUrl)
assert.equal(parsed.numberOfItems, 3)
assert.equal(parsed.numberOfItems, courseCatalog.length)
assert.equal(parsed.itemListOrder, 'https://schema.org/ItemListOrderAscending')
assert.ok(Array.isArray(parsed.itemListElement))
assert.equal(parsed.itemListElement.length, 3)

const expectedUrls = courseCatalog.map((course) => `${coursesUrl}#course-${course.id}`)
assert.equal(new Set(expectedUrls).size, 3)

parsed.itemListElement.forEach((listItem, index) => {
  const course = courseCatalog[index]
  const expectedUrl = expectedUrls[index]

  assert.equal(listItem['@type'], 'ListItem')
  assert.equal(listItem.position, index + 1)
  assert.equal(listItem.url, expectedUrl)
  assert.equal(listItem.item['@type'], 'Course')
  assert.equal(listItem.item['@id'], expectedUrl)
  assert.equal(listItem.item.url, expectedUrl)
  assert.equal(listItem.item.name, course.title)
  assert.equal(listItem.item.description, course.description)
  assert.equal(listItem.item.inLanguage, 'zh-TW')
  assert.deepEqual(listItem.item.provider, {
    '@type': 'Organization',
    '@id': organizationId,
    name: 'WATERBOTTLE 紫微命理',
    url: 'https://tsu-waterbottle.com/',
  })
  assert.ok(course.description.length > 0)
  assert.ok(course.description.length <= 60)
  assert.equal(/價格|折扣|促銷|立即購買|最佳|保證/.test(course.title), false)
})

assert.deepEqual(
  parsed.itemListElement.map((listItem) => listItem.position),
  [1, 2, 3],
)
assert.deepEqual(
  parsed.itemListElement.map((listItem) => listItem.item.name),
  courseCatalog.map((course) => course.title),
)
assert.deepEqual(
  parsed.itemListElement.map((listItem) => listItem.item.description),
  courseCatalog.map((course) => course.description),
)

for (const forbiddenValue of [
  'CourseInstance',
  'Offer',
  'price',
  'priceCurrency',
  'availability',
  'startDate',
  'endDate',
  'validFrom',
  'priceValidUntil',
  'instructor',
  'Person',
  'Event',
  'courseMode',
  'location',
  'duration',
  'aggregateRating',
  'review',
  'potentialAction',
  'SearchAction',
  'Product',
  'coursePrerequisites',
  'hasCourseInstance',
  'sameAs',
  'subtitle',
  'alternateName',
  'headline',
  'disambiguatingDescription',
  'undefined',
  'null',
  'localhost',
  'vercel.app',
]) {
  assert.equal(serialized.includes(forbiddenValue), false)
}

function assertNoEmptyValues(value: unknown, path = 'schema'): void {
  if (value === undefined) assert.fail(`${path} must not be undefined`)
  if (value === null) assert.fail(`${path} must not be null`)

  if (typeof value === 'string') {
    assert.notEqual(value.trim(), '', `${path} must not be empty`)
    return
  }

  if (Array.isArray(value)) {
    assert.ok(value.length > 0, `${path} must not be an empty array`)
    value.forEach((entry, index) => assertNoEmptyValues(entry, `${path}[${index}]`))
    return
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    assert.ok(entries.length > 0, `${path} must not be an empty object`)
    entries.forEach(([key, entry]) => assertNoEmptyValues(entry, `${path}.${key}`))
  }
}

assertNoEmptyValues(COURSE_LIST_JSON_LD)

const injectionProbe = serializeJsonLd({ value: '</script><script>alert(1)</script>' })
assert.equal(injectionProbe.includes('<'), false)
assert.deepEqual(JSON.parse(injectionProbe), {
  value: '</script><script>alert(1)</script>',
})
assert.throws(() => serializeJsonLd(undefined), /must be serializable/)

const coursesPage = readFileSync(join(root, 'src/app/courses/page.tsx'), 'utf8')
assert.equal(coursesPage.match(/course-list-structured-data/g)?.length, 1)
assert.ok(coursesPage.includes('type="application/ld+json"'))
assert.ok(coursesPage.includes('serializeJsonLd(COURSE_LIST_JSON_LD)'))
assert.ok(coursesPage.indexOf("redirect('/')") < coursesPage.indexOf('course-list-structured-data'))

const coursesClient = readFileSync(join(root, 'src/app/courses/courses-client.tsx'), 'utf8')
assert.ok(coursesClient.includes('id={`course-${course.id}`}'))

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(path)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : []
  })
}

const filesWithCourseScript = collectTsxFiles(join(root, 'src/app')).filter((file) =>
  readFileSync(file, 'utf8').includes('course-list-structured-data'),
)
assert.deepEqual(filesWithCourseScript, [join(root, 'src/app/courses/page.tsx')])

for (const file of [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/ai-chart/page.tsx',
  'src/app/ai-divination/page.tsx',
  'src/app/booking/page.tsx',
  'src/app/spiritual-products/page.tsx',
]) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.equal(source.includes('course-list-structured-data'), false)
}

console.log('course JSON-LD tests passed')
