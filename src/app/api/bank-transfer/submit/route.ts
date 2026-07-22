import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: 'bank_transfer_retired',
      message: '銀行匯款付款方式已停止使用，請改用網站提供的線上付款方式。',
    },
    { status: 410 },
  )
}
