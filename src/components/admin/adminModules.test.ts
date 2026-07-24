import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_MODULES,
  getAdminModulesBySection,
  isAdminModuleActive,
} from './adminModules'

const keys = ADMIN_MODULES.map((module) => module.key)
assert.equal(new Set(keys).size, keys.length, 'module keys must be unique')

const hrefs = ADMIN_MODULES
  .map((module) => module.href)
  .filter((href): href is string => href !== null)
assert.equal(new Set(hrefs).size, hrefs.length, 'module hrefs must be unique')

const readonly = getAdminModulesBySection('readonly')
assert.equal(readonly.length, 4)
assert.deepEqual(readonly.map((module) => module.href), [
  '/admin/bookings',
  '/admin/product-orders',
  '/admin/members',
  '/admin/bank-transfers',
])
assert.equal(readonly.every((module) => module.availability === 'readonly'), true)

const tools = getAdminModulesBySection('tool')
assert.equal(tools.length, 1)
assert.equal(tools[0]?.href, '/admin/booking-slots')
assert.equal(tools[0]?.availability, 'tool')

const unavailable = getAdminModulesBySection('unavailable')
assert.ok(unavailable.length > 0)
assert.equal(unavailable.every((module) => module.href === null), true)
assert.equal(unavailable.every((module) => module.availability === 'unavailable'), true)

const productOrders = readonly.find((module) => module.key === 'product-orders')
assert.ok(productOrders)
assert.equal(isAdminModuleActive(productOrders, '/admin/product-orders'), true)
assert.equal(isAdminModuleActive(productOrders, '/admin/product-orders/order-id'), true)
assert.equal(isAdminModuleActive(productOrders, '/admin/members'), false)

for (const moduleDefinition of ADMIN_MODULES) {
  assert.ok(moduleDefinition.label)
  assert.ok(moduleDefinition.description)
  assert.ok(moduleDefinition.iconKey)
  assert.ok(moduleDefinition.matchingPaths.length > 0)
}

const root = process.cwd()
const pageSource = readFileSync(join(root, 'src/app/admin/page.tsx'), 'utf8')
const navigationSource = readFileSync(
  join(root, 'src/components/admin/AdminNavigation.tsx'),
  'utf8',
)
assert.match(pageSource, /ADMIN_MODULES|getAdminModulesBySection/)
assert.match(navigationSource, /ADMIN_MODULES|getAdminModulesBySection/)

console.log('✓ admin module registry tests passed')
