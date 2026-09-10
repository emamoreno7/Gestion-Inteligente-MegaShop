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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.location_id) {
      return NextResponse.json({ error: 'Usuario sin local asignado' }, { status: 403 })
    }

    const { product_id, quantity_change, adjustment_type, notes } = await req.json()
    if (!product_id || !quantity_change || !adjustment_type || !notes) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const idempotency_key = crypto.randomUUID()

    const { data, error } = await supabase.rpc('manual_stock_adjustment', {
      p_product_id: product_id,
      p_location_id: userData.location_id,
      p_quantity_change: quantity_change,
      p_adjustment_type: adjustment_type,
      p_notes: notes,
      p_idempotency_key: idempotency_key,
    })

    if (error) {
      console.error('Error manual_stock_adjustment:', error)
      await logBackendError(supabase, error, { route: '/api/inventory/adjust' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'stock', 'Ajuste manual de stock', {
      product_id,
      quantity_change,
      adjustment_type,
      notes,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en inventory/adjust:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/inventory/adjust' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}