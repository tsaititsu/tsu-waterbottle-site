import assert from 'node:assert/strict'
import {
  handleDeleteAiChartProfile,
  handleListAiChartProfiles,
  handleSaveAiChartProfile,
} from './handler'
import type { MemberAiChartProfile } from '@/lib/ai-chart/chartProfiles'

const ownerId = '3df1a8da-3893-4b81-8d00-774a9cc0e473'
const profileId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const profile: MemberAiChartProfile = {
  id: profileId,
  category: '自己',
  input: {
    solarDate: '1990-05-20',
    timeIndex: 6,
    gender: 'female',
    name: '測試會員',
    birthPlace: '台灣彰化',
    fixLeap: false,
  },
}

const request = new Request('https://example.test/api/account/chart-profiles')
const validBody = {
  category: ' 自己 ',
  birthInput: {
    solarDate: '1990-05-20',
    timeIndex: 6,
    gender: 'female',
    name: ' 測試會員 ',
    birthPlace: ' 台灣彰化 ',
  },
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

async function main() {
  {
    let receivedUserId = ''
    const response = await handleListAiChartProfiles(request, {
      resolveUserId: async () => ownerId,
      listProfiles: async (userId) => {
        receivedUserId = userId
        return [profile]
      },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(receivedUserId, ownerId)
    assert.deepEqual(await json(response), { ok: true, profiles: [profile] })
  }

  {
    const savedInputs: Record<string, unknown>[] = []
    const response = await handleSaveAiChartProfile(request, validBody, {
      resolveUserId: async () => ownerId,
      saveProfile: async (input) => {
        savedInputs.push(input as unknown as Record<string, unknown>)
        return profile
      },
    })
    assert.equal(response.status, 200)
    assert.equal(savedInputs[0]?.userId, ownerId)
    assert.equal(savedInputs[0]?.category, '自己')
    assert.deepEqual(
      (savedInputs[0]?.birthInput as Record<string, unknown>).birthPlace,
      '台灣彰化',
    )
  }

  for (const body of [
    { ...validBody, userId: 'attacker-controlled' },
    { ...validBody, birthInput: { ...validBody.birthInput, birthPlace: ' ' } },
    { ...validBody, id: 'not-a-uuid' },
  ]) {
    let writes = 0
    const response = await handleSaveAiChartProfile(request, body, {
      resolveUserId: async () => ownerId,
      saveProfile: async () => {
        writes += 1
        return profile
      },
    })
    assert.equal(response.status, 400)
    assert.equal(writes, 0)
  }

  {
    let deletedOwner = ''
    let deletedId = ''
    const response = await handleDeleteAiChartProfile(
      request,
      { id: profileId },
      {
        resolveUserId: async () => ownerId,
        deleteProfile: async ({ userId, id }) => {
          deletedOwner = userId
          deletedId = id
          return true
        },
      },
    )
    assert.equal(response.status, 200)
    assert.equal(deletedOwner, ownerId)
    assert.equal(deletedId, profileId)
  }

  {
    let reads = 0
    const response = await handleListAiChartProfiles(request, {
      resolveUserId: async () => null,
      listProfiles: async () => {
        reads += 1
        return []
      },
    })
    assert.equal(response.status, 401)
    assert.equal(reads, 0)
  }

  console.log(
    '✓ member AI chart profile handlers derive ownership and validate writes',
  )
}

void main()
