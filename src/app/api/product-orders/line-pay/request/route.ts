import { handleProductOrderLinePayRequest } from './handler'
import { getProductOrderLinePayPreflightContext } from '../../../../../lib/supabase/productOrders'

export async function POST(request: Request) {
  return handleProductOrderLinePayRequest({
    request,
    env: process.env,
    productOrderReader: getProductOrderLinePayPreflightContext,
  })
}
