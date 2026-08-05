import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const integrations = [
  'src/components/ChartResultSessionView.tsx',
  'src/components/divination/DivinationDrawPreview.tsx',
  'src/components/BookingForm.tsx',
  'src/app/cart/page.tsx',
]

for (const path of integrations) {
  const source = readFileSync(join(process.cwd(), path), 'utf8')
  assert.match(
    source,
    /useLinePayEntryOneDollarTest/,
    `${path} must use the server-authorized availability hook`,
  )
  assert.match(
    source,
    /LinePayEntryOneDollarTestButton/,
    `${path} must render the shared admin test button`,
  )
  assert.match(
    source,
    /adminOneDollarTest/,
    `${path} must explicitly opt the admin button into the NT$1 server path`,
  )
}

console.log('four LINE Pay entry NT$1 integrations are wired')
