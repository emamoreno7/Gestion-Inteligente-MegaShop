import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function logBackendError(
  supabase: any,
  error: any,
  context?: { route?: string; metadata?: Record<string, any> }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let locationId: string | null = null
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', user.id)
        .single()
      locationId = userData?.location_id || null
    } catch {}

    const message = error?.message || error?.toString() || 'Error no especificado'
    const stack = error?.stack || null

    await supabase.from('error_logs').insert({
      user_id: user.id,
      location_id: locationId,
      source: 'backend',
      message,
      stack,
      route: context?.route || null,
      metadata: context?.metadata || {},
    })
  } catch (e) {
    // Silencioso para no provocar bucles
  }
}