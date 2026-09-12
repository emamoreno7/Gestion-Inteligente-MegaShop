import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logBackendError } from '@/lib/logger-server'
import { logUserActivity } from '@/lib/activity-server'

export async function GET() {
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.location_id) {
      return NextResponse.json({ error: 'Usuario sin local asignado' }, { status: 403 })
    }

    const locationId = userData.location_id

    const { data: session, error: sessionError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .maybeSingle()

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

    if (!session) {
      return NextResponse.json({ session: null, movements: [] })
    }

    const { data: cashMovements, error: cashMovementsError } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })

    if (cashMovementsError) return NextResponse.json({ error: cashMovementsError.message }, { status: 500 })

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, user_id, created_at')
      .eq('location_id', locationId)
      .gte('created_at', session.opened_at)
      .in('status', ['completed'])

    if (salesError) return NextResponse.json({ error: salesError.message }, { status: 500 })

    const saleIds = (sales || []).map((s: any) => s.id)
    let payments: any[] = []

    if (saleIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, sale_id, method, amount, status, created_at')
        .in('sale_id', saleIds)
        .eq('status', 'completed')

      if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 })
      payments = paymentsData || []
    }

    const combined = [...(cashMovements || [])]

    for (const p of payments) {
      if (p.method === 'cash') continue

      combined.push({
        id: p.id,
        movement_type: p.method,
        amount: Number(p.amount),
        notes: `Venta ${p.method === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'}`,
        created_at: p.created_at,
        user_full_name: null,
      })
    }

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ session, movements: combined })
  } catch (error: any) {
    console.error('Error en cash/movements GET:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/cash/movements' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

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

    const { session_id, amount, movement_type, notes } = await req.json()
    if (!session_id || !amount || !movement_type) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const idempotency_key = crypto.randomUUID()

    const { data, error } = await supabase.rpc('register_cash_movement', {
      p_session_id: session_id,
      p_amount: amount,
      p_movement_type: movement_type,
      p_idempotency_key: idempotency_key,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Error register_cash_movement:', error)
      await logBackendError(supabase, error, { route: '/api/cash/movements' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'caja', 'Movimiento manual de caja', {
      session_id,
      movement_type,
      amount,
      notes,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en cash/movements POST:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/cash/movements' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}