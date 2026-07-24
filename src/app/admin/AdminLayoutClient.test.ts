import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/admin/AdminLayoutClient.tsx'), 'utf8')
const sessionRoute = readFileSync(join(process.cwd(), 'src/app/api/admin/session/route.ts'), 'utf8')

assert.match(source, /createAdminPageAccessController/)
assert.match(source, /getAccessToken: getAuthAccessToken/)
assert.match(source, /fetchSession: \(input, init\) => fetch\(input, init\)/)
assert.match(source, /\(snapshot\) => setAccessState\(snapshot\.state\)/)
assert.match(source, /controller\.run\(getMockUser\(\)\)/)
assert.match(source, /subscribeAuthChange/)
assert.match(source, /controller\.cancel\(\)/)
assert.doesNotMatch(source, /fetch\('\/api\/admin\/session'/)
assert.match(
  source,
  /if \(accessState === 'authorized'\) \{\s*return <AdminShell pathname=\{pathname\}>\{children\}<\/AdminShell>/,
)
assert.equal(source.match(/<AdminShell pathname=\{pathname\}>\{children\}<\/AdminShell>/g)?.length, 1)
assert.match(source, /if \(accessState === 'unauthenticated'\)/)
assert.match(source, /請先登入管理員帳號/)
assert.match(source, /登入完成後會返回目前的後台頁面/)
assert.match(
  source,
  /<LoginModal[\s\S]*open=\{loginOpen\}[\s\S]*returnTo=\{returnTo\}[\s\S]*mode="admin"/,
)
assert.match(source, /sanitizeAuthReturnPath\(`\$\{pathname\}\$\{window\.location\.search\}`\)/)
assert.doesNotMatch(source, /router\.replace\('\/'\)/)
assert.match(source, /if \(accessState === 'forbidden'\)[\s\S]*沒有管理權限/)
assert.match(source, /正在確認管理權限\.\.\./)
assert.match(sessionRoute, /requireAdminUser\(request\)/)

console.log('AdminLayoutClient auth gate tests passed')
