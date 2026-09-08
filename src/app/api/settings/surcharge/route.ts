import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
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

    // Verificar owner_admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single()

    if (roleError || roleData?.name !== 'owner_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'import_surcharge')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      enabled: data?.value?.enabled ?? false,
      percentage: data?.value?.percentage ?? 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single()

    if (roleError || roleData?.name !== 'owner_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { enabled, percentage } = await req.json()

    if (typeof enabled !== 'boolean' || typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'import_surcharge',
          value: { enabled, percentage },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}