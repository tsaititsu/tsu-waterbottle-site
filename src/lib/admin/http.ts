import { NextResponse } from 'next/server'

export const ADMIN_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
}

export function withAdminNoStore(response: Response) {
  for (const [name, value] of Object.entries(ADMIN_NO_STORE_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

export function adminJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...ADMIN_NO_STORE_HEADERS,
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  })
}
