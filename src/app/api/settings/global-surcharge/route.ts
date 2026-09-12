import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logUserActivity } from '@/lib/activity-server'

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
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.location_id) {
      return NextResponse.json({ error: 'Usuario sin local asignado' }, { status: 403 })
    }

    const { percentage } = await req.json()
    if (percentage === undefined || isNaN(Number(percentage))) {
      return NextResponse.json({ error: 'Porcentaje inválido' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('apply_global_surcharge', {
      p_location_id: userData.location_id,
      p_percentage: Number(percentage),
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logUserActivity(supabase, 'precio', 'Aplicación de recargo global de precios', {
      percentage: Number(percentage),
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}