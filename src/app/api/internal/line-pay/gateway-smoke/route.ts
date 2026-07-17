import { requireAdminUser } from '@/lib/auth/admin'
import { handleLinePayGatewaySmoke } from './handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleLinePayGatewaySmoke({
    request,
    env: process.env,
    authorize: async (smokeRequest) => {
      const auth = await requireAdminUser(smokeRequest)
      return !('error' in auth)
    },
  })
}
