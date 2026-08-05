export async function checkLinePayEntryOneDollarTestAvailability(input: {
  getAccessToken: () => Promise<string | null>
  fetchStatus?: typeof fetch
}) {
  try {
    const accessToken = await input.getAccessToken()
    if (!accessToken) return false

    const fetchStatus = input.fetchStatus ?? fetch
    const response = await fetchStatus(
      '/api/admin/line-pay-entry-one-dollar-test',
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) return false

    const payload = await response.json().catch(() => null) as {
      ok?: unknown
      enabled?: unknown
    } | null
    return payload?.ok === true && payload.enabled === true
  } catch {
    return false
  }
}
