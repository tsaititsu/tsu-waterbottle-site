import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mapAiChartProfileRow,
  normalizeAiChartProfileCategory,
  normalizeAiChartProfileId,
  type AiChartProfileRow,
} from './chartProfiles'

const profileId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const row: AiChartProfileRow = {
  id: profileId,
  user_id: '3df1a8da-3893-4b81-8d00-774a9cc0e473',
  category: ' 自己 ',
  name: ' 測試會員 ',
  gender: 'female',
  solar_date: '1990-05-20',
  birth_time: '6',
  birth_place: ' 台灣彰化 ',
  ziwei_payload: { fixLeap: true },
}

assert.equal(normalizeAiChartProfileId(profileId), profileId)
assert.equal(normalizeAiChartProfileId('not-an-id'), null)
assert.equal(normalizeAiChartProfileCategory(' 客戶 '), '客戶')
assert.equal(normalizeAiChartProfileCategory(' '), null)
assert.equal(normalizeAiChartProfileCategory('分'.repeat(81)), null)
assert.deepEqual(mapAiChartProfileRow(row), {
  id: profileId,
  category: '自己',
  input: {
    solarDate: '1990-05-20',
    timeIndex: 6,
    gender: 'female',
    name: '測試會員',
    birthPlace: '台灣彰化',
    fixLeap: true,
  },
})
assert.deepEqual(mapAiChartProfileRow({ ...row, birth_place: null })?.input, {
  solarDate: '1990-05-20',
  timeIndex: 6,
  gender: 'female',
  name: '測試會員',
  fixLeap: true,
})
assert.equal(mapAiChartProfileRow({ ...row, birth_time: '13' }), null)
assert.equal(mapAiChartProfileRow({ ...row, gender: 'other' }), null)

const repositorySource = readFileSync(
  join(process.cwd(), 'src/lib/supabase/chartProfiles.ts'),
  'utf8',
)
assert.equal(repositorySource.includes(".eq('user_id', userId)"), true)
assert.equal(repositorySource.match(/\.eq\('user_id', input\.userId\)/g)?.length, 2)
assert.equal(repositorySource.includes(".select('*')"), false)

const clientSource = readFileSync(
  join(process.cwd(), 'src/lib/ai-chart/chartProfilesClient.ts'),
  'utf8',
)
const lineSessionCheck = clientSource.indexOf("fetch('/api/auth/line/session'")
const profileRequest = clientSource.indexOf("fetch('/api/account/chart-profiles'")
assert.equal(lineSessionCheck >= 0, true)
assert.equal(profileRequest > lineSessionCheck, true)
assert.equal(clientSource.includes('if (!sessionResponse.ok || !session?.user?.id)'), true)

console.log('✓ member AI chart profile contracts preserve category and birthplace compatibility')
