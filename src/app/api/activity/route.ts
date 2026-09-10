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

    if (roleName !== 'owner_admin' && roleName !== 'encargado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { data: activities, error } = await supabase
      .from('user_activity_logs')
      .select(`
        id,
        user_id,
        location_id,
        action,
        description,
        details,
        created_at,
        user:users(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const mapped = (activities || []).map((a: any) => ({
      id: a.id,
      user_name: Array.isArray(a.user) ? a.user[0]?.full_name : a.user?.full_name || 'Desconocido',
      location_id: a.location_id,
      action: a.action,
      description: a.description,
      details: a.details,
      created_at: a.created_at,
    }))

    return NextResponse.json({ activities: mapped })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}