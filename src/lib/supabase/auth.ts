import { getSupabaseAdmin, hasSupabaseAdminConfig } from './admin'

export async function getUserIdFromRequest(req: Request) {
  if (!hasSupabaseAdminConfig()) return null

  const authorization = req.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null

  return data.user.id
}

export async function getUserWithEmailFromRequest(
  req: Request,
): Promise<{ id: string; email: string | null } | null> {
  if (!hasSupabaseAdminConfig()) return null

  const authorization = req.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null

  return { id: data.user.id, email: data.user.email ?? null }
}
