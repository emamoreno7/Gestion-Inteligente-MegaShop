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

    const { items, payment_method } = await req.json()
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items vacíos' }, { status: 400 })
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'Método de pago requerido' }, { status: 400 })
    }

    let rpcName = 'create_sale'
    let rpcParams: any = {
      p_items: items,
      p_payment_method: payment_method,
      p_location_id: userData.location_id,
    }

    if (payment_method === 'mercadopago' || payment_method === 'transfer') {
      rpcName = 'create_pending_sale'
      rpcParams.p_idempotency_key = crypto.randomUUID()
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams)

    if (error) {
      console.error(`Error creando venta (${rpcName}):`, error)
      await logBackendError(supabase, error, { route: '/api/sales/create' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'venta', 'Nueva venta / cobro', {
      payment_method,
      items_count: items.length,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en sales/create:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/sales/create' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}