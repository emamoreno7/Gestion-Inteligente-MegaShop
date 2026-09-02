import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    const { session_id, final_cash } = await req.json()
    if (!session_id || final_cash === undefined) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('close_cash_session', {
      p_session_id: session_id,
      p_user_id: user.id,
      p_final_cash: final_cash,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}