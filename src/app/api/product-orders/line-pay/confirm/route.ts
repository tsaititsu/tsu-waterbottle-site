import { handleProductOrderLinePayConfirmRedirect } from './handler'

export async function GET(request: Request) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env: process.env,
  })
}
