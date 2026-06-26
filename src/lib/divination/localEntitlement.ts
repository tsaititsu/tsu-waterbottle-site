import { randomUUID } from "crypto"

export const READING_COST_TWD = 50
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
      error: "DAILY_FREE_USED"
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

function hasReservedDailyFree(localUserId: string, taiwanDate: string) {
  const store = getStore()

  return Array.from(store.reservations.values()).some(
    (reservation) =>
      reservation.localUserId === localUserId &&
      reservation.taiwanDate === taiwanDate &&
      reservation.type === "daily_free" &&
      reservation.status === "reserved"
  )
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
  const taiwanDate = getTaiwanDateKey()
  const freeUsed = user.lastFreeReadingDate === taiwanDate
  const freeReserved = hasReservedDailyFree(user.localUserId, taiwanDate)
  const canUseDailyFree = !freeUsed && !freeReserved

  if (!canUseDailyFree && !input.mockPaid) {
    return {
      ok: false,
      error: "DAILY_FREE_USED",
      message: "今日免費占卜已使用，請使用 NT$50 單次占卜。",
      requiresPayment: true,
      amountTwd: READING_COST_TWD,
    }
  }

  const type: LocalEntitlementType = canUseDailyFree ? "daily_free" : "mock_paid"
  const entitlement = {
    readingId: input.readingId,
    localUserId: user.localUserId,
    type,
    amountTwd: type === "daily_free" ? 0 : READING_COST_TWD,
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

  const user = getOrCreateUser(entitlement.localUserId)

  if (entitlement.type === "daily_free") {
    user.lastFreeReadingDate = entitlement.taiwanDate
  }

  entitlement.status = "consumed"
  entitlement.consumedAt = new Date().toISOString()
  getStore().reservations.set(readingId, entitlement)

  return entitlement
}
