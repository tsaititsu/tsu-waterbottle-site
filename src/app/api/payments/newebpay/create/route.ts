import {
  handleCreateNewebPayPaymentRequest,
  type CreateNewebPayPaymentRequest,
} from './handler'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateNewebPayPaymentRequest | null
  return handleCreateNewebPayPaymentRequest(body)
}
