import { getPaymentByMerchantOrderNo } from '@/lib/supabase/payments'
import { createNewebPayPublicReturnRoute } from './handler'

const handlers = createNewebPayPublicReturnRoute({ getPaymentByMerchantOrderNo })

export const GET = handlers.GET
export const POST = handlers.POST
