import { requireAdminUser } from '@/lib/auth/admin'
import { handleDivinationOneDollarTestStatus } from './handler'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleDivinationOneDollarTestStatus({
    request,
    env: process.env,
    authorizeAdmin: async (statusRequest) => {
      const auth = await requireAdminUser(statusRequest)
      return 'error' in auth ? auth.error : null
    },
  })
}
