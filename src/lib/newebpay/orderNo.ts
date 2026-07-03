import { randomBytes } from 'node:crypto'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatMerchantOrderTimestamp(now: Date) {
  return [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join('')
}

function createRandomCode() {
  return randomBytes(2).toString('hex').toUpperCase()
}

export function generateNewebPayMerchantOrderNo(now = new Date(), randomCode = createRandomCode()) {
  const normalizedRandomCode = randomCode.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase() || createRandomCode()
  const merchantOrderNo = `WB${formatMerchantOrderTimestamp(now)}${normalizedRandomCode}`.slice(0, 30)

  if (!/^[A-Z0-9_]{1,30}$/.test(merchantOrderNo)) {
    throw new Error('Generated MerchantOrderNo must contain only letters, numbers, or underscores and be at most 30 characters')
  }

  return merchantOrderNo
}
