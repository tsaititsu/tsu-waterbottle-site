import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UserProfile } from './types'
import {
  createLineSessionCookieValue,
  LINE_SESSION_MAX_AGE_SECONDS,
  readLineSessionCookieValue,
} from './line'

const TEST_SESSION_SECRET = 'booking-ownership-test-secret'
const NOW = new Date('2026-07-15T00:00:00.000Z')
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)

const user: UserProfile = {
  id: '6f0b8f2e-1234-4c56-9abc-def012345678',
  provider: 'line',
  lineUserId: 'line-provider-id',
  displayName: 'LINE 會員',
  createdAt: '2026-07-01T00:00:00.000Z',
  lastLoginAt: '2026-07-15T00:00:00.000Z',
}

function signedCookie(payloadValue: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(payloadValue)).toString('base64url')
  const signature = createHmac('sha256', TEST_SESSION_SECRET)
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

function tamperSignature(cookie: string) {
  const lastCharacter = cookie.at(-1)
  return `${cookie.slice(0, -1)}${lastCharacter === 'a' ? 'b' : 'a'}`
}

function readIssuedAt(cookie: string) {
  const [payload] = cookie.split('.')
  return (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    iat?: unknown
  }).iat
}

async function run() {
  process.env.LINE_SESSION_SECRET = TEST_SESSION_SECRET

  try {
    const validCookie = createLineSessionCookieValue(user, NOW)
    assert.equal(readIssuedAt(validCookie), NOW_SECONDS)
    assert.deepEqual(readLineSessionCookieValue(validCookie, NOW), user)

    assert.equal(readLineSessionCookieValue(tamperSignature(validCookie), NOW), null)
    assert.equal(readLineSessionCookieValue(signedCookie({ user }), NOW), null)
    assert.equal(readLineSessionCookieValue(signedCookie({ user, iat: 'invalid' }), NOW), null)
    assert.equal(
      readLineSessionCookieValue(
        signedCookie({ user, iat: NOW_SECONDS - LINE_SESSION_MAX_AGE_SECONDS - 1 }),
        NOW,
      ),
      null,
    )
    assert.equal(
      readLineSessionCookieValue(signedCookie({ user, iat: NOW_SECONDS + 61 }), NOW),
      null,
    )
    assert.deepEqual(
      readLineSessionCookieValue(
        signedCookie({ user, iat: NOW_SECONDS - LINE_SESSION_MAX_AGE_SECONDS }),
        NOW,
      ),
      user,
    )

    // 舊版發行的是 Unix 毫秒；仍驗證同一 TTL，避免安全修正強制全員登出。
    assert.deepEqual(
      readLineSessionCookieValue(signedCookie({ user, iat: NOW.getTime() }), NOW),
      user,
    )

    const expiredLegacyIatMs =
      (NOW_SECONDS - LINE_SESSION_MAX_AGE_SECONDS - 1) * 1000
    assert.equal(
      readLineSessionCookieValue(
        signedCookie({ user, iat: expiredLegacyIatMs }),
        NOW,
      ),
      null,
    )

    assert.equal(
      readLineSessionCookieValue(
        signedCookie({ user: { ...user, id: '   ' }, iat: NOW_SECONDS }),
        NOW,
      ),
      null,
    )

    const callbackSource = readFileSync(
      join(process.cwd(), 'src/app/api/auth/line/callback/route.ts'),
      'utf8',
    )
    assert.match(callbackSource, /LINE_SESSION_MAX_AGE_SECONDS/)
    assert.match(callbackSource, /maxAge:\s*LINE_SESSION_MAX_AGE_SECONDS/)
    assert.equal(LINE_SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 30)

    console.log('LINE session tests passed')
  } finally {
    delete process.env.LINE_SESSION_SECRET
  }
}

void run()
