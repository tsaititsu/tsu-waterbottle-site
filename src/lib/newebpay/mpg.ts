import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getNewebPayConfig } from './config'
import type { CoursePaymentPayload, NewebPayConfig, NewebPayMpgForm, NewebPayTradeInfoFields } from './types'

const mpgVersion = '2.0'

function encodeTradeInfo(fields: NewebPayTradeInfoFields) {
  const params = new URLSearchParams()
  params.set('MerchantID', fields.MerchantID)
  params.set('RespondType', fields.RespondType)
  params.set('TimeStamp', fields.TimeStamp)
  params.set('Version', fields.Version)
  params.set('MerchantOrderNo', fields.MerchantOrderNo)
  params.set('Amt', fields.Amt)
  params.set('ItemDesc', fields.ItemDesc)
  if (fields.Email) params.set('Email', fields.Email)
  params.set('LoginType', fields.LoginType)
  params.set('NotifyURL', fields.NotifyURL)
  params.set('ReturnURL', fields.ReturnURL)
  params.set('ClientBackURL', fields.ClientBackURL)
  params.set('CREDIT', fields.CREDIT)
  return params.toString()
}

function createCipherConfig(config: NewebPayConfig) {
  return {
    key: Buffer.from(config.hashKey, 'utf8'),
    iv: Buffer.from(config.hashIv, 'utf8'),
  }
}

export function generateMerchantOrderNo(prefix = 'COURSE') {
  const normalizedPrefix = prefix.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'COURSE'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = randomBytes(4).toString('hex').toUpperCase()
  return `${normalizedPrefix}${timestamp}${random}`.slice(0, 30)
}

export function buildCoursePaymentTradeInfoFields(
  payload: CoursePaymentPayload,
  config = getNewebPayConfig(),
): NewebPayTradeInfoFields {
  return {
    MerchantID: config.merchantId,
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    Version: mpgVersion,
    MerchantOrderNo: payload.merchantOrderNo,
    Amt: String(payload.amount),
    ItemDesc: payload.itemDesc,
    ...(payload.email ? { Email: payload.email } : {}),
    LoginType: '0',
    NotifyURL: payload.notifyUrl,
    ReturnURL: payload.returnUrl,
    ClientBackURL: payload.clientBackUrl,
    CREDIT: '1',
  }
}

export function encryptTradeInfo(plainTradeInfo: string, config = getNewebPayConfig()) {
  const { key, iv } = createCipherConfig(config)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  return cipher.update(plainTradeInfo, 'utf8', 'hex') + cipher.final('hex')
}

export function createTradeInfo(payload: CoursePaymentPayload, config = getNewebPayConfig()) {
  return encryptTradeInfo(encodeTradeInfo(buildCoursePaymentTradeInfoFields(payload, config)), config)
}

export function createTradeSha(encryptedTradeInfo: string, config = getNewebPayConfig()) {
  const text = `HashKey=${config.hashKey}&${encryptedTradeInfo}&HashIV=${config.hashIv}`
  return createHash('sha256').update(text).digest('hex').toUpperCase()
}

export function verifyTradeSha(encryptedTradeInfo: string, tradeSha: string, config = getNewebPayConfig()) {
  const expected = createTradeSha(encryptedTradeInfo, config)
  const normalizedTradeSha = tradeSha.toUpperCase()

  if (expected.length !== normalizedTradeSha.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedTradeSha))
}

export function decryptTradeInfo(encryptedTradeInfo: string, config = getNewebPayConfig()): unknown {
  const { key, iv } = createCipherConfig(config)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = decipher.update(encryptedTradeInfo, 'hex', 'utf8') + decipher.final('utf8')

  try {
    return JSON.parse(decrypted)
  } catch {
    return Object.fromEntries(new URLSearchParams(decrypted))
  }
}

export function createCoursePaymentMpgForm(payload: CoursePaymentPayload, config = getNewebPayConfig()): NewebPayMpgForm {
  const tradeInfo = createTradeInfo(payload, config)

  return {
    MerchantID: config.merchantId,
    TradeInfo: tradeInfo,
    TradeSha: createTradeSha(tradeInfo, config),
    Version: mpgVersion,
    actionUrl: config.mpgEndpoint,
  }
}
