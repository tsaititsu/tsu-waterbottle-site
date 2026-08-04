import { executePublicProductOrderLinePayCallbackRoute } from '../callbackRoute'

export async function GET(request: Request) {
  return executePublicProductOrderLinePayCallbackRoute('confirm', request)
}
