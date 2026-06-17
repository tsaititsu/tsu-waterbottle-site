import { NextResponse } from 'next/server'
import { sendBookingConfirmationEmails } from '@/lib/email/sendBookingEmails'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = await sendBookingConfirmationEmails(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : '寄送預約確認信失敗'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
