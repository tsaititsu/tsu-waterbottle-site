import {
  handleCreateProductOrderRequest,
  type CreateProductOrderRequest,
} from './handler'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateProductOrderRequest | null
  return handleCreateProductOrderRequest(body)
}
