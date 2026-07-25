import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const actionButton = readFileSync(join(root, 'src/components/ActionButton.tsx'), 'utf8')
const pricingSection = readFileSync(join(root, 'src/components/PricingSection.tsx'), 'utf8')
const mockData = readFileSync(join(root, 'src/lib/mockData.ts'), 'utf8')

// Login remains the only gate on the homepage action. The component no longer
// imports or invokes the legacy local mock-payment flow.
assert.match(actionButton, /import \{ getMockUser, subscribeAuthChange \} from '@\/lib\/mockAuth'/)
assert.match(actionButton, /createAsyncIdentityGuard/)
assert.match(actionButton, /subscribeAuthChange/)
assert.match(actionButton, /identityGuard\.isCurrent\(requestToken, currentIdentity\(\)\)/)
assert.equal(actionButton.includes('<LoginModal'), true)
assert.equal(actionButton.includes('createMockPayment'), false)
assert.equal(actionButton.includes('PaymentConfirmModal'), false)
assert.equal(actionButton.includes('/payment/success'), false)
assert.equal(actionButton.includes('/booking/success'), false)
assert.equal(actionButton.includes('result-pay-'), false)
assert.equal(actionButton.includes('localStorage'), false)
assert.equal(actionButton.includes("method: 'POST'"), false)
assert.equal(actionButton.includes('fetch('), false)

// Authenticated users continue to the selected service route. PricingSection
// passes the plan href explicitly instead of deriving a paid result locally.
assert.equal(actionButton.includes('router.push(destination)'), true)
assert.equal(actionButton.includes("'ai-divination': '/ai-divination'"), true)
assert.equal(actionButton.includes("'ai-chart': '/ai-chart'"), true)
assert.equal(actionButton.includes("booking: '/booking'"), true)
assert.equal(pricingSection.includes('href={plan.href}'), true)

for (const [label, href] of [
  ['立即占卜', '/ai-divination'],
  ['立即分析', '/ai-chart'],
  ['立即預約', '/booking'],
]) {
  assert.equal(mockData.includes(`cta: '${label}'`), true)
  assert.equal(mockData.includes(`href: '${href}'`), true)
}

// Existing visual classes remain unchanged, including the 48px-equivalent
// py-3 button sizing used by all three pricing cards.
assert.equal(
  pricingSection.includes('focus-ring mt-6 w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white'),
  true,
)

console.log('✓ homepage ActionButton no longer creates mock payments')
