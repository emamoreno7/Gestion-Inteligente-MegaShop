import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

    const locationId = userData.location_id

    const { data: session, error: sessionError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .maybeSingle()

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

    if (!session) {
      return NextResponse.json({
        summary: {
          cash_total: 0,
          mercadopago_total: 0,
          transfer_total: 0,
          sales_count: 0,
        },
      })
    }

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', session.opened_at)
      .eq('status', 'completed')

    if (salesError) return NextResponse.json({ error: salesError.message }, { status: 500 })

    const saleIds = (sales || []).map((s: any) => s.id)

    let cashTotal = 0
    let mercadopagoTotal = 0
    let transferTotal = 0

    if (saleIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('method, amount, status')
        .in('sale_id', saleIds)
        .eq('status', 'completed')

      if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 })

      for (const p of payments || []) {
        if (p.method === 'cash') cashTotal += Number(p.amount)
        else if (p.method === 'mercadopago') mercadopagoTotal += Number(p.amount)
        else if (p.method === 'transfer') transferTotal += Number(p.amount)
      }
    }

    return NextResponse.json({
      summary: {
        cash_total: cashTotal,
        mercadopago_total: mercadopagoTotal,
        transfer_total: transferTotal,
        sales_count: (sales || []).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}