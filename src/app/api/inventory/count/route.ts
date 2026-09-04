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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.location_id) {
      return NextResponse.json({ error: 'Usuario sin local asignado' }, { status: 403 })
    }

    const { product_id, counted_quantity, notes } = await req.json()
    if (!product_id || counted_quantity === undefined) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const idempotency_key = crypto.randomUUID()

    const { data, error } = await supabase.rpc('record_stock_count', {
      p_product_id: product_id,
      p_location_id: userData.location_id,
      p_counted_quantity: counted_quantity,
      p_idempotency_key: idempotency_key,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Error record_stock_count:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}