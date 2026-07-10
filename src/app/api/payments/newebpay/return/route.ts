import { getPaymentByMerchantOrderNo } from '@/lib/supabase/payments'
import { handleNewebPayReturnGet, handleNewebPayReturnPost } from './handler'

export async function GET(request: Request) {
  return handleNewebPayReturnGet(request)
}

export async function POST(request: Request) {
  return handleNewebPayReturnPost(request, { getPaymentByMerchantOrderNo })
}
