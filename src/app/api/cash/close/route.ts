import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logBackendError } from '@/lib/logger-server'
import { logUserActivity } from '@/lib/activity-server'

export async function POST(req: NextRequest) {
  let supabase: any = null

  try {
    const cookieStore = await cookies()
    supabase = createServerClient(
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

    const { session_id, final_cash, notes } = await req.json()
    if (!session_id || final_cash === undefined) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('close_cash_session', {
      p_session_id: session_id,
      p_counted_cash: final_cash,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Error close_cash_session:', error)
      await logBackendError(supabase, error, { route: '/api/cash/close' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'caja', 'Cierre de caja', {
      session_id,
      final_cash,
      notes: notes || null,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en cash/close:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/cash/close' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}