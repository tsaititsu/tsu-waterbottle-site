import { handleAdminProductOrdersList } from './handler'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleAdminProductOrdersList(request)
}
