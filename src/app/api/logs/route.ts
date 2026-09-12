import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role:roles(name)')
      .eq('id', user.id)
      .single()

    if (userError || !userData) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

    const roleData = Array.isArray(userData.role) ? userData.role[0] : userData.role
    const roleName = roleData?.name || null

    if (roleName !== 'owner_admin') {
      return NextResponse.json({ error: 'No autorizado. Solo administrador.' }, { status: 403 })
    }

    const { data: logs, error } = await supabase
      .from('error_logs')
      .select(`
        id,
        user_id,
        location_id,
        source,
        message,
        stack,
        route,
        metadata,
        created_at,
        user:users(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const mapped = (logs || []).map((log: any) => ({
      id: log.id,
      user_name: Array.isArray(log.user) ? log.user[0]?.full_name : log.user?.full_name || 'Desconocido',
      location_id: log.location_id,
      source: log.source,
      message: log.message,
      stack: log.stack,
      route: log.route,
      metadata: log.metadata,
      created_at: log.created_at,
    }))

    return NextResponse.json({ logs: mapped })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}