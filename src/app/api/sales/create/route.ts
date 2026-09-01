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

    const { items, payment_method } = await req.json()
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items vacíos' }, { status: 400 })
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'Método de pago requerido' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('create_sale', {
      p_items: items,
      p_payment_method: payment_method,
      p_location_id: userData.location_id,
      p_user_id: user.id,
    })

    if (error) {
      console.error('Error creando venta:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en sales/create:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}