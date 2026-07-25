import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const readSource = (path: string) => readFileSync(join(root, path), 'utf8')

function listRuntimeSources(directory: string): string[] {
  return readdirSync(join(root, directory)).flatMap((name) => {
    const absolutePath = join(root, directory, name)
    const repositoryPath = relative(root, absolutePath)
    if (statSync(absolutePath).isDirectory()) return listRuntimeSources(repositoryPath)
    if (!/\.(?:ts|tsx)$/u.test(name) || /\.(?:test|spec)\.(?:ts|tsx)$/u.test(name)) return []
    return [repositoryPath]
  })
}

const adminClientSource = readSource('src/lib/supabase/admin.ts')
assert.match(adminClientSource, /^import 'server-only'/)

for (const path of listRuntimeSources('src')) {
  const source = readSource(path)
  if (!source.startsWith("'use client'") && !source.startsWith('"use client"')) continue
  assert.doesNotMatch(source, /['"](?:@\/)?lib\/supabase\/admin['"]/, path)
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/, path)
}

for (const path of [
  'src/app/api/account/course-purchases/route.ts',
  'src/app/api/account/divination-readings/handler.ts',
  'src/app/api/ai-chart/reports/read/handler.ts',
  'src/app/api/auth/sync-profile/route.ts',
  'src/app/api/bookings/read/handler.ts',
  'src/app/api/courses/route.ts',
]) {
  const source = readSource(path)
  assert.doesNotMatch(source, /(?:NextResponse\.json|console\.(?:error|warn))[\s\S]{0,180}error\.message/, path)
  assert.doesNotMatch(source, /details:\s*error\.details|hint:\s*error\.hint/, path)
}

const lineCallbackSource = readSource('src/app/api/auth/line/callback/route.ts')
assert.match(lineCallbackSource, /\/auth\/callback\?error=line_login_failed/)
assert.doesNotMatch(lineCallbackSource, /encodeURIComponent\(message\)/)

const newebPayCreateSource = readSource('src/app/api/payments/newebpay/create/handler.ts')
const newebPayLogCalls =
  newebPayCreateSource.match(/console\.(?:error|warn)\([^)]*\)/g) ?? []
assert.ok(newebPayLogCalls.length > 0)
for (const logCall of newebPayLogCalls) {
  assert.doesNotMatch(
    logCall,
    /amount|itemKey|orderId|paymentId|merchantOrderNo|reportId|readingId|error:|input\./,
  )
}

console.log('server-only and redacted backend error boundary contracts passed')
