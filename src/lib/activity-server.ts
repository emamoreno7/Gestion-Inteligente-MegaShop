import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea un cliente Supabase de servidor autenticado con las cookies.
 * Solo para uso del lado del servidor (API routes, server components).
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
}

/**
 * Registra una actividad de usuario en la tabla user_activity_logs.
 * Es silencioso: si falla, no interrumpe la operación principal.
 *
 * @param supabase Cliente Supabase ya autenticado.
 * @param action Categoría de la acción, ej: 'login', 'cobro', 'stock', 'precio'.
 * @param description Texto legible de lo ocurrido.
 * @param details Metadatos adicionales (producto, monto, etc).
 */
export async function logUserActivity(
  supabase: any,
  action: string,
  description: string,
  details: Record<string, any> = {}
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

    await supabase.from('user_activity_logs').insert({
      user_id: user.id,
      location_id: locationId,
      action,
      description,
      details: details || {},
    })
  } catch {
    // Silencioso para no provocar bucles ni romper la operación principal
  }
}