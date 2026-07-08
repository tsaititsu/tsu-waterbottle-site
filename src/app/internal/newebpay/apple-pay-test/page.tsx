import { notFound } from 'next/navigation'
import { ApplePayTestClient } from './ApplePayTestClient'

export const dynamic = 'force-dynamic'

export default function NewebPayApplePayTestPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY_APPLE_PAY_TEST_ENTRY !== 'true') {
    notFound()
  }

  return <ApplePayTestClient />
}
