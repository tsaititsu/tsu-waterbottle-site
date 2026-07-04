import { createHash } from 'node:crypto'

import type { NewebPayEnv } from './types'

export type NewebPayQueryResult = {
  status: string
  message?: string
  merchantOrderNo: string
  amount: number
  tradeStatus?: string
  tradeNo?: string
  paymentType?: string
  paymentMethod?: string
  payTime?: string
  rawResult: Record<string, unknown>
}

export type QueryNewebPayTradeInput = {
  merchantId: string
  merchantOrderNo: string
  amount: number
  hashKey: string
  hashIv: string
  env: NewebPayEnv
}

const queryTradeInfoUrls: Record<NewebPayEnv, string> = {
  test: 'https://ccore.newebpay.com/API/QueryTradeInfo',
  production: 'https://core.newebpay.com/API/QueryTradeInfo',
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function getOptionalString(value: unknown) {
  const text = getString(value).trim()
  return text || undefined
}

function getAmount(value: unknown) {
  const amount = Number(getString(value))
  return Number.isFinite(amount) ? amount : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getResultRecord(root: Record<string, unknown>) {
  return isRecord(root.Result) ? root.Result : root
}

export function getNewebPayQueryTradeInfoUrl(env: NewebPayEnv) {
  return queryTradeInfoUrls[env]
}

export function createQueryCheckValue({
  merchantId,
  merchantOrderNo,
  amount,
  hashKey,
  hashIv,
}: {
  merchantId: string
  merchantOrderNo: string
  amount: number
  hashKey: string
  hashIv: string
}): string {
  const text = `IV=${hashIv}&Amt=${amount}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${hashKey}`
  return createHash('sha256').update(text).digest('hex').toUpperCase()
}

export function buildNewebPayQueryTradeInfoBody(input: QueryNewebPayTradeInput, now = new Date()) {
  return new URLSearchParams({
    MerchantID: input.merchantId,
    Version: '1.3',
    RespondType: 'JSON',
    CheckValue: createQueryCheckValue(input),
    TimeStamp: String(Math.floor(now.getTime() / 1000)),
    MerchantOrderNo: input.merchantOrderNo,
    Amt: String(input.amount),
  })
}

function sanitizeQueryRawResult(result: NewebPayQueryResult): Record<string, unknown> {
  return {
    status: result.status,
    message: result.message ?? null,
    merchantOrderNo: result.merchantOrderNo,
    amount: result.amount,
    tradeStatus: result.tradeStatus ?? null,
    tradeNo: result.tradeNo ?? null,
    paymentType: result.paymentType ?? null,
    paymentMethod: result.paymentMethod ?? null,
    payTime: result.payTime ?? null,
  }
}

export async function queryNewebPayTrade(input: QueryNewebPayTradeInput): Promise<NewebPayQueryResult> {
  const response = await fetch(getNewebPayQueryTradeInfoUrl(input.env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildNewebPayQueryTradeInfoBody(input),
  })

  if (!response.ok) {
    throw new Error(`NewebPay query failed with HTTP ${response.status}`)
  }

  const text = await response.text()
  const root = JSON.parse(text) as unknown
  if (!isRecord(root)) {
    throw new Error('Invalid NewebPay query response')
  }

  const result = getResultRecord(root)
  const parsed: NewebPayQueryResult = {
    status: getString(root.Status || result.Status),
    message: getOptionalString(root.Message || result.Message),
    merchantOrderNo: getString(result.MerchantOrderNo || root.MerchantOrderNo),
    amount: getAmount(result.Amt || root.Amt),
    tradeStatus: getOptionalString(result.TradeStatus),
    tradeNo: getOptionalString(result.TradeNo),
    paymentType: getOptionalString(result.PaymentType),
    paymentMethod: getOptionalString(result.PaymentMethod),
    payTime: getOptionalString(result.PayTime),
    rawResult: {},
  }

  if (!parsed.status) {
    throw new Error('Missing NewebPay query status')
  }

  if (!parsed.merchantOrderNo) {
    throw new Error('Missing NewebPay query MerchantOrderNo')
  }

  parsed.rawResult = sanitizeQueryRawResult(parsed)
  return parsed
}
