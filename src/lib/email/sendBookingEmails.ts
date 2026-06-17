import { createZiweiGptPayload } from '@/features/ziwei-chart/package'

export type BookingEmailPayload = {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  planName: string
  amount: number
  startTimeText: string
  endTimeText: string
  birthDate?: string
  birthTime?: string
  birthPlace?: string
  gender?: string
  isBirthTimeAccurate?: boolean
  question?: string
  cancellationReason?: string
}

type ResendEmailResponse = {
  id?: string
  message?: string
  name?: string
}

type EmailAttachment = {
  filename: string
  content: string
}

const resendEndpoint = 'https://api.resend.com/emails'

function escapeHtml(value: string | number | boolean | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatPrice(amount: number) {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

function optionalRow(label: string, value?: string | boolean) {
  if (value === undefined || value === '') return ''
  const text = typeof value === 'boolean' ? (value ? '知道準確出生時間' : '不確定準確出生時間') : value
  return `<p><strong>${escapeHtml(label)}：</strong>${escapeHtml(text)}</p>`
}

function genderLabel(value?: string) {
  const labels: Record<string, string> = {
    male: '男',
    female: '女',
    other: '其他 / 不透露'
  }

  return value ? (labels[value] ?? value) : undefined
}

function toZiweiTimeIndex(birthTime?: string) {
  if (!birthTime) return null
  const hour = Number(birthTime.split(':')[0])
  if (Number.isNaN(hour)) return null
  if (hour === 0) return 0
  if (hour >= 1 && hour <= 2) return 1
  if (hour >= 3 && hour <= 4) return 2
  if (hour >= 5 && hour <= 6) return 3
  if (hour >= 7 && hour <= 8) return 4
  if (hour >= 9 && hour <= 10) return 5
  if (hour >= 11 && hour <= 12) return 6
  if (hour >= 13 && hour <= 14) return 7
  if (hour >= 15 && hour <= 16) return 8
  if (hour >= 17 && hour <= 18) return 9
  if (hour >= 19 && hour <= 20) return 10
  if (hour >= 21 && hour <= 22) return 11
  if (hour === 23) return 12
  return null
}

function svgText(value: string | number | boolean | undefined) {
  return escapeHtml(value)
}

const branchGrid: Record<string, [number, number]> = {
  巳: [0, 0],
  午: [0, 1],
  未: [0, 2],
  申: [0, 3],
  辰: [1, 0],
  酉: [1, 3],
  卯: [2, 0],
  戌: [2, 3],
  寅: [3, 0],
  丑: [3, 1],
  子: [3, 2],
  亥: [3, 3]
}

function renderStarNames(stars: Array<{ name: string; mutagen?: string }>, x: number, y: number, color: string, size: number, max = 6) {
  return stars
    .slice(0, max)
    .map((star, index) => {
      const dx = x + (index % 3) * 40
      const dy = y + Math.floor(index / 3) * (size + 6)
      return `<text x="${dx}" y="${dy}" fill="${star.mutagen ? '#c4382b' : color}" font-size="${size}" font-weight="${star.mutagen ? 800 : 700}">${svgText(star.name)}</text>`
    })
    .join('')
}

function renderZiweiChartSvg(payload: BookingEmailPayload) {
  if (!payload.birthDate || !payload.birthTime || !['male', 'female'].includes(payload.gender ?? '')) return null

  try {
    const timeIndex = toZiweiTimeIndex(payload.birthTime)
    if (timeIndex === null) return null

    const chartPayload = createZiweiGptPayload({
      solarDate: payload.birthDate,
      timeIndex,
      gender: payload.gender as 'male' | 'female',
      name: payload.customerName
    })
    const { chart } = chartPayload
    const width = 1600
    const height = 1200
    const cellW = 400
    const cellH = 300
    const palaces = chart.palaces
      .map((palace) => {
        const position = branchGrid[palace.earthlyBranch]
        if (!position) return ''
        const [row, col] = position
        const x = col * cellW
        const y = row * cellH
        const minorStars = [...palace.minorStars, ...palace.adjectiveStars]
        const decadal = `${palace.decadal.range[0]}-${palace.decadal.range[1]}`
        const palaceNameColor = palace.isOriginalPalace ? '#c4382b' : '#5b94cf'
        return `
          <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#f8f7f3" stroke="#d2d2d2" stroke-width="3" />
          ${renderStarNames(palace.majorStars, x + 18, y + 40, '#17171c', 34, 5)}
          ${renderStarNames(minorStars, x + 18, y + 92, '#5b94cf', 25, 6)}
          <text x="${x + 18}" y="${y + 210}" fill="#378342" font-size="20" font-weight="700">${svgText(palace.ages.slice(0, 8).join(' '))}</text>
          <text x="${x + 24}" y="${y + 248}" fill="#8d8d8d" font-size="22">${svgText(palace.minorStars.slice(0, 3).map((star) => star.name).join(' ') || '')}</text>
          <text x="${x + cellW - 108}" y="${y + cellH - 28}" fill="#1d1b24" font-size="26">${svgText(decadal)}</text>
          <text x="${x + cellW - 76}" y="${y + cellH - 28}" fill="${palaceNameColor}" font-size="30" font-weight="800">${svgText(palace.name)}</text>
          <text x="${x + cellW - 34}" y="${y + cellH - 28}" fill="#8d8d8d" font-size="28">${svgText(palace.earthlyBranch)}</text>
        `
      })
      .join('')

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#f4f3ef" />
        ${palaces}
        <rect x="${cellW}" y="${cellH}" width="${cellW * 2}" height="${cellH * 2}" fill="#ffffff" stroke="#d2d2d2" stroke-width="3" />
        <text x="${width / 2}" y="455" text-anchor="middle" fill="#1d1b24" font-size="42" font-weight="800">${svgText(chart.birthInfo.name || payload.customerName)}</text>
        <text x="${width / 2}" y="515" text-anchor="middle" fill="#1d1b24" font-size="38" font-weight="800">${svgText(chart.birthInfo.timeIndex === 12 ? '晚子時' : ['早子時', '丑時', '寅時', '卯時', '辰時', '巳時', '午時', '未時', '申時', '酉時', '戌時', '亥時'][chart.birthInfo.timeIndex] ?? '')}</text>
        <text x="${width / 2}" y="565" text-anchor="middle" fill="#8d8d8d" font-size="28">${svgText(payload.birthTime)}</text>
        <text x="${width / 2}" y="620" text-anchor="middle" fill="#8d8d8d" font-size="32">${svgText(genderLabel(chart.birthInfo.gender))}</text>
        <text x="${width / 2}" y="675" text-anchor="middle" fill="#8d8d8d" font-size="32">${svgText(chart.fiveElementsClass)}</text>
        <line x1="${cellW + 40}" x2="${cellW * 3 - 40}" y1="725" y2="725" stroke="#dcdcdc" stroke-width="2" />
        <text x="${cellW + 40}" y="775" fill="#8d8d8d" font-size="28">陽曆</text>
        <text x="${cellW * 3 - 40}" y="775" text-anchor="end" fill="#1d1b24" font-size="28">${svgText(chart.birthInfo.solarDate)}</text>
        <text x="${cellW + 40}" y="825" fill="#8d8d8d" font-size="28">農曆</text>
        <text x="${cellW * 3 - 40}" y="825" text-anchor="end" fill="#1d1b24" font-size="28">${svgText(chart.birthInfo.lunarDate)}</text>
        <rect x="${cellW + 260}" y="860" width="180" height="54" rx="8" fill="#2f2d3d" />
        <text x="${cellW + 350}" y="895" text-anchor="middle" fill="#ffffff" font-size="24" font-weight="700">命盤核對</text>
        <text x="${width / 2}" y="980" text-anchor="middle" fill="#6f6878" font-size="24">請核對出生日期、出生時間與命盤是否正確</text>
      </svg>
    `
  } catch {
    return null
  }
}

async function buildChartAttachment(payload: BookingEmailPayload): Promise<EmailAttachment | undefined> {
  const svg = renderZiweiChartSvg(payload)
  if (!svg) return undefined
  const safeName = (payload.customerName || payload.bookingId).replace(/[\\/:*?"<>|]/g, '').trim() || payload.bookingId
  const sharp = (await import('sharp')).default
  const png = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer()

  return {
    filename: `紫微命盤-${safeName}.png`,
    content: png.toString('base64')
  }
}

function bookingHtml(payload: BookingEmailPayload, variant: 'customer' | 'admin') {
  const customerName = payload.customerName || '客人'
  const title = variant === 'customer' ? '水瓶先生論命預約確認' : `${customerName} 諮詢預約`
  const intro =
    variant === 'customer'
      ? '你的預約已完成付款並建立紀錄，信件附件有依照你填寫的出生資料產生的命盤圖，請先核對出生時間與命盤是否正確。'
      : '網站收到一筆付款完成的水瓶先生論命預約，請確認以下資訊。'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif; color: #221a33; line-height: 1.7; max-width: 640px;">
      <h1 style="color: #3b0b73; font-size: 28px; margin: 0 0 16px;">${title}</h1>
      <p style="font-size: 16px; margin: 0 0 24px;">${intro}</p>
      <div style="border: 1px solid #e7dff0; border-radius: 18px; padding: 22px; background: #fbf8ff;">
        <p><strong>預約編號：</strong>${escapeHtml(payload.bookingId)}</p>
        <p><strong>姓名：</strong>${escapeHtml(payload.customerName)}</p>
        <p><strong>Email：</strong>${escapeHtml(payload.customerEmail)}</p>
        ${optionalRow('電話', payload.customerPhone)}
        <p><strong>方案：</strong>${escapeHtml(payload.planName)}</p>
        <p><strong>金額：</strong>${escapeHtml(formatPrice(payload.amount))}</p>
        <p><strong>時間：</strong>${escapeHtml(payload.startTimeText)} - ${escapeHtml(payload.endTimeText)}</p>
        ${optionalRow('性別', genderLabel(payload.gender))}
        ${optionalRow('生日', payload.birthDate)}
        ${optionalRow('時辰', payload.birthTime)}
        ${optionalRow('出生地', payload.birthPlace)}
        ${optionalRow('出生時間狀態', payload.isBirthTimeAccurate)}
        ${optionalRow('想諮詢的問題', payload.question)}
      </div>
      <p style="color: #6f6878; font-size: 14px; margin-top: 24px;">這封信由 WATERBOTTLE 預約系統自動寄出。</p>
    </div>
  `
}

function cancellationHtml(payload: BookingEmailPayload, variant: 'customer' | 'admin') {
  const customerName = payload.customerName || '客人'
  const title = variant === 'customer' ? '水瓶先生論命預約取消確認' : `${customerName} 取消諮詢預約`
  const intro =
    variant === 'customer'
      ? '你的水瓶先生論命預約已取消。若有退款或改期需求，請等待官方協助處理。'
      : '客人已取消水瓶先生論命預約，請確認以下資訊並處理後續退款或改期。'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif; color: #221a33; line-height: 1.7; max-width: 640px;">
      <h1 style="color: #3b0b73; font-size: 28px; margin: 0 0 16px;">${title}</h1>
      <p style="font-size: 16px; margin: 0 0 24px;">${intro}</p>
      <div style="border: 1px solid #e7dff0; border-radius: 18px; padding: 22px; background: #fbf8ff;">
        <p><strong>預約編號：</strong>${escapeHtml(payload.bookingId)}</p>
        <p><strong>姓名：</strong>${escapeHtml(payload.customerName)}</p>
        <p><strong>Email：</strong>${escapeHtml(payload.customerEmail)}</p>
        ${optionalRow('電話', payload.customerPhone)}
        <p><strong>方案：</strong>${escapeHtml(payload.planName)}</p>
        <p><strong>金額：</strong>${escapeHtml(formatPrice(payload.amount))}</p>
        <p><strong>原預約時間：</strong>${escapeHtml(payload.startTimeText)} - ${escapeHtml(payload.endTimeText)}</p>
        ${optionalRow('取消原因', payload.cancellationReason)}
      </div>
      <p style="color: #6f6878; font-size: 14px; margin-top: 24px;">這封信由 WATERBOTTLE 預約系統自動寄出。</p>
    </div>
  `
}

async function sendResendEmail(input: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}) {
  const response = await fetch(resendEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.attachments?.length ? { attachments: input.attachments } : {})
    })
  })

  const data = (await response.json().catch(() => ({}))) as ResendEmailResponse

  if (!response.ok) {
    throw new Error(data.message || data.name || 'Resend 寄信失敗')
  }

  return data
}

export async function sendBookingConfirmationEmails(payload: BookingEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL

  if (!apiKey || !from || !adminEmail) {
    return {
      mocked: true,
      customerEmailResult: { id: `mock-customer-email-${payload.bookingId}` },
      adminEmailResult: { id: `mock-admin-email-${payload.bookingId}` }
    }
  }

  const chartAttachment = await buildChartAttachment(payload)
  const [customerEmailResult, adminEmailResult] = await Promise.allSettled([
    sendResendEmail({
      apiKey,
      from,
      to: payload.customerEmail,
      subject: `水瓶先生論命預約確認｜${payload.planName}`,
      html: bookingHtml(payload, 'customer'),
      attachments: chartAttachment ? [chartAttachment] : undefined
    }),
    sendResendEmail({
      apiKey,
      from,
      to: adminEmail,
      subject: `${payload.customerName || '客人'} 諮詢預約`,
      html: bookingHtml(payload, 'admin')
    })
  ])

  const errors = [
    customerEmailResult.status === 'rejected' ? `客人確認信：${customerEmailResult.reason instanceof Error ? customerEmailResult.reason.message : '寄送失敗'}` : '',
    adminEmailResult.status === 'rejected' ? `老師通知信：${adminEmailResult.reason instanceof Error ? adminEmailResult.reason.message : '寄送失敗'}` : ''
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new Error(errors.join('；'))
  }

  if (customerEmailResult.status !== 'fulfilled' || adminEmailResult.status !== 'fulfilled') {
    throw new Error('寄送預約確認信失敗')
  }

  return {
    mocked: false,
    customerEmailResult: customerEmailResult.value,
    adminEmailResult: adminEmailResult.value
  }
}

export async function sendBookingCancellationEmails(payload: BookingEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL

  if (!apiKey || !from || !adminEmail) {
    return {
      mocked: true,
      customerEmailResult: { id: `mock-customer-cancel-email-${payload.bookingId}` },
      adminEmailResult: { id: `mock-admin-cancel-email-${payload.bookingId}` }
    }
  }

  const [customerEmailResult, adminEmailResult] = await Promise.allSettled([
    sendResendEmail({
      apiKey,
      from,
      to: payload.customerEmail,
      subject: `水瓶先生論命預約取消確認｜${payload.planName}`,
      html: cancellationHtml(payload, 'customer')
    }),
    sendResendEmail({
      apiKey,
      from,
      to: adminEmail,
      subject: `${payload.customerName || '客人'} 取消諮詢預約`,
      html: cancellationHtml(payload, 'admin')
    })
  ])

  const errors = [
    customerEmailResult.status === 'rejected' ? `客人取消信：${customerEmailResult.reason instanceof Error ? customerEmailResult.reason.message : '寄送失敗'}` : '',
    adminEmailResult.status === 'rejected' ? `老師取消通知：${adminEmailResult.reason instanceof Error ? adminEmailResult.reason.message : '寄送失敗'}` : ''
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new Error(errors.join('；'))
  }

  if (customerEmailResult.status !== 'fulfilled' || adminEmailResult.status !== 'fulfilled') {
    throw new Error('寄送預約取消信失敗')
  }

  return {
    mocked: false,
    customerEmailResult: customerEmailResult.value,
    adminEmailResult: adminEmailResult.value
  }
}
