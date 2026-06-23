import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: '課程購買已改用藍新金流，請從課程頁重新購買。',
    },
    { status: 410 },
  )
}
