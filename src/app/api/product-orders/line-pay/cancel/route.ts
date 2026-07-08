import { handleProductOrderLinePayCancelRedirect } from './handler'

export async function GET(request: Request) {
  return handleProductOrderLinePayCancelRedirect({
    request,
    env: process.env,
  })
}
