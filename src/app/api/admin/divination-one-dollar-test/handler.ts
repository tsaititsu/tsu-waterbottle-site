import { NextResponse } from 'next/server'
import { isDivinationOneDollarTestModeEnabled } from '../../../../lib/newebpay/divinationOneDollarTest'
import type { NewebPayOneDollarTestEnv } from '../../../../lib/newebpay/oneDollarTestMode'

type AuthorizeAdmin = (request: Request) => Promise<Response | null>

export async function handleDivinationOneDollarTestStatus(input: {
  request: Request
  env: NewebPayOneDollarTestEnv
  authorizeAdmin: AuthorizeAdmin
}) {
  try {
    const authError = await input.authorizeAdmin(input.request)
    if (authError) return authError

    return NextResponse.json({
      ok: true,
      enabled: isDivinationOneDollarTestModeEnabled(input.env),
    })
  } catch {
    console.error('Unexpected divination one dollar test status error')
    return NextResponse.json({ ok: false, error: '確認測試模式狀態失敗。' }, { status: 500 })
  }
}
