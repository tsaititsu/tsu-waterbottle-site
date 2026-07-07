import { handleProductOrderLinePayRequest } from './handler'

export async function POST(request: Request) {
  return handleProductOrderLinePayRequest({
    request,
    env: process.env,
  })
}
