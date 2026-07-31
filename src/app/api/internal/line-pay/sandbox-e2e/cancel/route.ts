import { executeLinePaySandboxE2eCallbackRoute } from '../callbackRoute'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return executeLinePaySandboxE2eCallbackRoute('cancel', request)
}
