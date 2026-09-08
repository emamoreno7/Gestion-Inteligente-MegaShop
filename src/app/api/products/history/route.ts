import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
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

    const productId = req.nextUrl.searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'Falta product_id' }, { status: 400 })

    // Movimientos de stock
    const { data: movements, error: movError } = await supabase
      .from('stock_movements')
      .select('id, movement_type, quantity_change, notes, created_at, performed_by, user:users(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (movError) return NextResponse.json({ error: movError.message }, { status: 500 })

    // Eventos de precio en auditoría
    const { data: priceEvents, error: auditError } = await supabase
      .from('audit_logs')
      .select('id, action, details, created_at, user_id, user:users(full_name)')
      .eq('entity', 'product_location_data')
      .eq('entity_id', productId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 })

    return NextResponse.json({
      movements: movements || [],
      price_events: priceEvents || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}