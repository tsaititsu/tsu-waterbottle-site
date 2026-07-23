import { handleAdminBankTransferDetail } from '../handler'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return handleAdminBankTransferDetail(request, id)
}
