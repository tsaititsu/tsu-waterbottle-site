import { NextResponse } from 'next/server'
import {
  requireAdminUser,
  type RequireAdminUserResult,
} from '@/lib/auth/admin'
import { generateMerchantOrderNo } from '@/lib/newebpay/mpg'
import {
  buildNewebPayOneDollarTestContext,
  isNewebPayOneDollarTestModeEnabled,
  type NewebPayOneDollarTestEnv,
} from '@/lib/newebpay/oneDollarTestMode'

export const NEWEBPAY_ADMIN_ONE_DOLLAR_TEST_CHANNELS = [
  'credit',
  'apple_pay',
  'atm',
] as const

export type NewebPayAdminOneDollarTestChannel =
  (typeof NEWEBPAY_ADMIN_ONE_DOLLAR_TEST_CHANNELS)[number]

export type NewebPayAdminOneDollarPaymentInsert = {
  userId: string
  provider: 'newebpay'
  itemType: 'newebpay_test'
  itemId: string
  itemName: string
  amountTwd: 1
  currency: 'TWD'
  status: 'pending'
  merchantOrderNo: string
  channel: NewebPayAdminOneDollarTestChannel
  rawPayload: Record<string, unknown> & {
    source: 'admin_newebpay_one_dollar_test'
    paymentMode: NewebPayAdminOneDollarTestChannel
    test_payment: true
    one_dollar_test_mode: true
    do_not_fulfill: true
  }
}

type AuthorizedAdmin = Exclude<RequireAdminUserResult, { error: NextResponse }>

type StartNewebPayAdminOneDollarTestDependencies = {
  env?: NewebPayOneDollarTestEnv
  authorize?: (request: Request) => Promise<RequireAdminUserResult>
  generateMerchantOrderNo?: (prefix?: string) => string
  insertPayment?: (
    input: NewebPayAdminOneDollarPaymentInsert,
    authorization: AuthorizedAdmin,
  ) => Promise<{ id: string }>
}

const channelDetails: Record<
  NewebPayAdminOneDollarTestChannel,
  { itemId: string; itemName: string }
> = {
  credit: {
    itemId: 'admin_credit_one_dollar_test',
    itemName: '管理員信用卡一次付清測試',
  },
  apple_pay: {
    itemId: 'admin_apple_pay_one_dollar_test',
    itemName: '管理員 Apple Pay 測試',
  },
  atm: {
    itemId: 'admin_atm_one_dollar_test',
    itemName: '管理員 ATM 虛擬帳號測試',
  },
}

export function isNewebPayAdminOneDollarTestEnabled(
  env: NewebPayOneDollarTestEnv,
) {
  return (
    env.NEWEBPAY_ENABLE_TEST_PAYMENT?.trim() === 'true'
    && isNewebPayOneDollarTestModeEnabled(env)
  )
}

function isTestChannel(
  value: unknown,
): value is NewebPayAdminOneDollarTestChannel {
  return (
    typeof value === 'string'
    && NEWEBPAY_ADMIN_ONE_DOLLAR_TEST_CHANNELS.includes(
      value as NewebPayAdminOneDollarTestChannel,
    )
  )
}

async function insertPaymentWithSupabase(
  input: NewebPayAdminOneDollarPaymentInsert,
  authorization: AuthorizedAdmin,
) {
  const { data, error } = await authorization.supabase
    .from('payments')
    .insert({
      user_id: input.userId,
      provider: input.provider,
      item_type: input.itemType,
      item_id: input.itemId,
      item_name: input.itemName,
      amount_twd: input.amountTwd,
      currency: input.currency,
      status: input.status,
      merchant_order_no: input.merchantOrderNo,
      raw_payload: input.rawPayload,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error('newebpay_admin_one_dollar_payment_insert_failed')
  }

  return { id: String(data.id) }
}

export async function handleStartNewebPayAdminOneDollarTest(
  request: Request,
  dependencies: StartNewebPayAdminOneDollarTestDependencies = {},
) {
  const env = dependencies.env ?? process.env
  if (!isNewebPayAdminOneDollarTestEnabled(env)) {
    return NextResponse.json(
      { ok: false, error: '測試付款功能未啟用。' },
      { status: 404 },
    )
  }

  const authorize = dependencies.authorize ?? requireAdminUser
  const authorization = await authorize(request)
  if ('error' in authorization) return authorization.error

  const body = (await request.json().catch(() => null)) as {
    channel?: unknown
  } | null
  if (!isTestChannel(body?.channel)) {
    return NextResponse.json(
      { ok: false, error: '不支援的管理員測試付款通道。' },
      { status: 400 },
    )
  }

  const channel = body.channel
  const details = channelDetails[channel]
  const context = buildNewebPayOneDollarTestContext({
    env,
    source: `admin_${channel}`,
    originalAmount: 1,
    itemDesc: details.itemName,
    metadata: {
      source: 'admin_newebpay_one_dollar_test',
      paymentMode: channel,
      one_dollar_test_mode: true,
      do_not_fulfill: true,
      test_channel: channel,
    },
  })

  if (!context.enabled || context.amount !== 1) {
    return NextResponse.json(
      { ok: false, error: '測試付款功能未啟用。' },
      { status: 404 },
    )
  }

  const merchantOrderNo = (
    dependencies.generateMerchantOrderNo ?? generateMerchantOrderNo
  )('NPTEST')
  const insertPayment = dependencies.insertPayment ?? insertPaymentWithSupabase

  try {
    const payment = await insertPayment(
      {
        userId: authorization.user.id,
        provider: 'newebpay',
        itemType: 'newebpay_test',
        itemId: details.itemId,
        itemName: context.itemDesc,
        amountTwd: 1,
        currency: 'TWD',
        status: 'pending',
        merchantOrderNo,
        channel,
        rawPayload: {
          ...context.metadata,
          source: 'admin_newebpay_one_dollar_test',
          paymentMode: channel,
          test_payment: true,
          one_dollar_test_mode: true,
          do_not_fulfill: true,
        },
      },
      authorization,
    )

    return NextResponse.json({ ok: true, paymentId: payment.id })
  } catch {
    console.error('NewebPay admin one dollar payment insert failed')
    return NextResponse.json(
      { ok: false, message: '建立測試付款失敗。' },
      { status: 500 },
    )
  }
}
