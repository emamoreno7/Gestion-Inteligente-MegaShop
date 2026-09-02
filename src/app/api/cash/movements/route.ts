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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.location_id) {
      return NextResponse.json({ error: 'Usuario sin local asignado' }, { status: 403 })
    }

    // Sesión abierta
    const { data: session, error: sessionError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', userData.location_id)
      .eq('status', 'open')
      .maybeSingle()

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

    let movements: any[] = []
    if (session) {
      const { data: movData, error: movError } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })

      if (movError) return NextResponse.json({ error: movError.message }, { status: 500 })
      movements = movData || []
    }

    return NextResponse.json({ session, movements })
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

    const { session_id, amount, movement_type, notes } = await req.json()
    if (!session_id || !amount || !movement_type) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('register_cash_movement', {
      p_session_id: session_id,
      p_user_id: user.id,
      p_amount: amount,
      p_movement_type: movement_type,
      p_notes: notes || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}