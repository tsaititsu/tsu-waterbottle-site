import { notFound } from 'next/navigation'
import { NewebPayTestClient } from './NewebPayTestClient'

export const dynamic = 'force-dynamic'

export default function NewebPayLocalTestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <NewebPayTestClient />
}
