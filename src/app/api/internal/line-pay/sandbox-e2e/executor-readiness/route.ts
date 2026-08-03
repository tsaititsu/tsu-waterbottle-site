import { requireAdminUser } from '@/lib/auth/admin'
import {
  createLinePayExecutorClient,
  probeLinePayExecutorCallbackReadiness,
} from '@/lib/supabase/linePayExecutor'
import { handleLinePayExecutorReadiness } from './handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleLinePayExecutorReadiness({
    request,
    env: process.env,
    authorize: async (readinessRequest) => {
      const auth = await requireAdminUser(readinessRequest)
      return !('error' in auth)
    },
    probe: () =>
      probeLinePayExecutorCallbackReadiness(
        createLinePayExecutorClient(process.env),
      ),
  })
}
