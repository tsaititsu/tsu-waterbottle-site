import { randomUUID } from "crypto"
import {
  DIVINATION_READING_PAYMENT_MESSAGE,
  DIVINATION_READING_PRICE_TWD,
} from "./pricing"

export const READING_COST_TWD = DIVINATION_READING_PRICE_TWD
export const TIME_ZONE = "Asia/Taipei"

type LocalEntitlementType = "daily_free" | "mock_paid"

type LocalUserState = {
  localUserId: string
  lastFreeReadingDate?: string
}

type LocalReadingEntitlement = {
  readingId: string
  localUserId: string
  type: LocalEntitlementType
  amountTwd: number
  taiwanDate: string
  entitlementToken: string
  status: "reserved" | "consumed"
  consumedAt?: string
}

type LocalEntitlementStore = {
  users: Map<string, LocalUserState>
  reservations: Map<string, LocalReadingEntitlement>
}

type ReserveInput = {
  readingId: string
  localUserId?: string
  mockPaid?: boolean
}

type ReserveResult =
  | {
      ok: true
      entitlement: LocalReadingEntitlement
    }
  | {
      ok: false
      error: "PAYMENT_REQUIRED"
      message: string
      requiresPayment: true
      amountTwd: number
    }

const DEFAULT_LOCAL_USER_ID = "local-dev-user"
const globalStoreKey = "__waterbottleLocalDivinationEntitlementStore"

type GlobalWithLocalEntitlement = typeof globalThis & {
  [globalStoreKey]?: LocalEntitlementStore
}

function getStore() {
  const globalWithStore = globalThis as GlobalWithLocalEntitlement

  if (!globalWithStore[globalStoreKey]) {
    globalWithStore[globalStoreKey] = {
      users: new Map(),
      reservations: new Map(),
    }
  }

  return globalWithStore[globalStoreKey]
}

function normalizeLocalUserId(localUserId?: string) {
  const trimmed = localUserId?.trim()
  return trimmed || DEFAULT_LOCAL_USER_ID
}

function getOrCreateUser(localUserId?: string) {
  const store = getStore()
  const safeLocalUserId = normalizeLocalUserId(localUserId)
  const existingUser = store.users.get(safeLocalUserId)

  if (existingUser) return existingUser

  const user: LocalUserState = {
    localUserId: safeLocalUserId,
  }

  store.users.set(safeLocalUserId, user)
  return user
}

export function getTaiwanDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function reserveLocalDivinationEntitlement(input: ReserveInput): ReserveResult {
  const store = getStore()
  const user = getOrCreateUser(input.localUserId)
  const existingEntitlement = store.reservations.get(input.readingId)

  if (existingEntitlement) {
    if (input.mockPaid !== true && existingEntitlement.type !== "mock_paid") {
      return {
        ok: false,
        error: "PAYMENT_REQUIRED",
        message: DIVINATION_READING_PAYMENT_MESSAGE,
        requiresPayment: true,
        amountTwd: READING_COST_TWD,
      }
    }

    if (existingEntitlement.type === "daily_free") {
      existingEntitlement.type = "mock_paid"
      existingEntitlement.amountTwd = READING_COST_TWD
      existingEntitlement.status = "reserved"
      store.reservations.set(input.readingId, existingEntitlement)
    }

    return {
      ok: true,
      entitlement: existingEntitlement,
    }
  }

  const taiwanDate = getTaiwanDateKey()
  const useMockPaid = input.mockPaid === true

  if (!useMockPaid) {
    return {
      ok: false,
      error: "PAYMENT_REQUIRED",
      message: DIVINATION_READING_PAYMENT_MESSAGE,
      requiresPayment: true,
      amountTwd: READING_COST_TWD,
    }
  }

  const type: LocalEntitlementType = "mock_paid"
  const entitlement = {
    readingId: input.readingId,
    localUserId: user.localUserId,
    type,
    amountTwd: READING_COST_TWD,
    taiwanDate,
    entitlementToken: randomUUID(),
    status: "reserved",
  } satisfies LocalReadingEntitlement

  store.reservations.set(input.readingId, entitlement)

  return {
    ok: true,
    entitlement,
  }
}

export function getLocalDivinationEntitlementStatus(readingId?: string, entitlementToken?: string) {
  if (!readingId) return null

  const entitlement = getStore().reservations.get(readingId)

  if (!entitlement) return null

  if (entitlementToken && entitlement.entitlementToken !== entitlementToken) {
    return null
  }

  return entitlement
}

export function consumeLocalDivinationEntitlement(readingId: string, entitlementToken?: string) {
  const entitlement = getLocalDivinationEntitlementStatus(readingId, entitlementToken)

  if (!entitlement) return null

  if (entitlement.status === "consumed") {
    return entitlement
  }

  if (entitlement.type === "daily_free") {
    return entitlement
  }

  entitlement.status = "consumed"
  entitlement.consumedAt = new Date().toISOString()
  getStore().reservations.set(readingId, entitlement)

  return entitlement
}

export function releaseLocalDivinationEntitlement(readingId?: string) {
  if (!readingId) return null

  const store = getStore()
  const entitlement = store.reservations.get(readingId)

  if (!entitlement) return null

  if (entitlement.status === "consumed") {
    return entitlement
  }

  store.reservations.delete(readingId)
  return entitlement
}
