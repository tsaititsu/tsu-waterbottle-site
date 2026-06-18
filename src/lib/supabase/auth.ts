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
