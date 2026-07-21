import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getLoginModalProviders, LoginModal } from './LoginModal'

const modalSource = readFileSync(join(process.cwd(), 'src/components/LoginModal.tsx'), 'utf8')
const authSource = readFileSync(join(process.cwd(), 'src/lib/mockAuth.ts'), 'utf8')
const headerSource = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf8')
const accountSource = readFileSync(join(process.cwd(), 'src/app/account/page.tsx'), 'utf8')

assert.match(modalSource, /returnTo\?: string/)
assert.match(modalSource, /mode\?: LoginModalMode/)
assert.match(modalSource, /mode = 'member'/)
assert.match(modalSource, /await loginWithProvider\(provider, returnTo\)/)
assert.match(modalSource, /onClick=\{\(\) => handleLogin\(provider\)\}/)
assert.equal(modalSource.match(/loginWithProvider\(/g)?.length, 1)
assert.doesNotMatch(modalSource, /localStorage|sessionStorage|https?:\/\//)

assert.deepEqual(getLoginModalProviders('member'), ['line', 'google'])
assert.deepEqual(getLoginModalProviders('admin'), ['google'])

const memberMarkup = renderToStaticMarkup(
  createElement(LoginModal, { open: true, onClose: () => {}, returnTo: '/account' }),
)
assert.match(memberMarkup, /請先登入會員/)
assert.match(memberMarkup, /登入後可以保存你的命盤、報告、占卜紀錄與預約資料。/)
assert.match(memberMarkup, /使用 LINE 登入/)
assert.match(memberMarkup, /使用 Google 帳號登入/)
assert.doesNotMatch(memberMarkup, /管理員白名單|Google 管理員帳號/)

const adminMarkup = renderToStaticMarkup(
  createElement(LoginModal, {
    open: true,
    onClose: () => {},
    returnTo: '/admin/bookings?status=paid',
    mode: 'admin',
  }),
)
assert.match(adminMarkup, /請登入管理員帳號/)
assert.match(adminMarkup, /請使用已加入管理員白名單的 Google 帳號登入。/)
assert.match(adminMarkup, /使用 Google 管理員帳號登入/)
assert.doesNotMatch(adminMarkup, /使用 LINE 登入/)
assert.doesNotMatch(adminMarkup, /保存你的命盤|報告、占卜紀錄/)

assert.match(authSource, /loginWithProvider\(provider: 'line' \| 'google', returnTo\?: string\)/)
assert.match(authSource, /loginWithLine\(returnTo\?: string\)/)
assert.match(authSource, /returnTo \?\? currentPath/)
assert.match(authSource, /sanitizeAuthReturnPath\(returnTo \?\? currentPath\)/)
assert.match(
  authSource,
  /buildSameOriginAuthCallbackUrl\(window\.location\.origin, safeReturnPath\)/,
)
assert.match(authSource, /loginWithLine\(safeReturnPath\)/)
assert.doesNotMatch(authSource, /NEXT_PUBLIC_SITE_URL/)
assert.equal(authSource.match(/buildSameOriginAuthCallbackUrl\(/g)?.length, 2)

assert.match(headerSource, /handleProviderLogin\('line'\)/)
assert.match(headerSource, /handleProviderLogin\('google'\)/)
assert.doesNotMatch(headerSource, /mode=["']admin["']/)
assert.match(accountSource, /<LoginModal/)
assert.doesNotMatch(accountSource, /mode=["']admin["']/)

console.log('LoginModal auth return contract tests passed')
