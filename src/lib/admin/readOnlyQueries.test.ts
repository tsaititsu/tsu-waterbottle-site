import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'

const fixture = join(process.cwd(), 'src/lib/admin/readOnlyQueries.fixture.ts')
const nextCompiledModules = join(process.cwd(), 'node_modules/next/dist/compiled')
const result = spawnSync(
  process.execPath,
  ['--conditions=react-server', ...process.execArgv, fixture],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: [nextCompiledModules, process.env.NODE_PATH].filter(Boolean).join(delimiter),
    },
  },
)

assert.equal(
  result.status,
  0,
  `server-only query fixture failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
)
assert.match(result.stdout, /ADMIN_READ_ONLY_QUERY_FIXTURE_PASS/)

console.log('✓ admin server-only query behavior tests passed')
