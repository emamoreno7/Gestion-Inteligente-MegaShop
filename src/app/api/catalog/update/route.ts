import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logUserActivity } from '@/lib/activity-server'

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
      return NextResponse.json({ error: 'Sin local asignado' }, { status: 403 })
    }

    // Verificar rol
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role:roles(name)')
      .eq('id', user.id)
      .single()

    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })

    const roleData = Array.isArray(userRoleData?.role) ? userRoleData.role[0] : userRoleData?.role
    const roleName = roleData?.name || null

    if (roleName !== 'owner_admin' && roleName !== 'encargado') {
      return NextResponse.json({ error: 'No autorizado para editar precios' }, { status: 403 })
    }

    const { product_id, cost_price, sale_price } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'Falta product_id' }, { status: 400 })

    const updateData: any = {}
    if (cost_price !== undefined) updateData.cost_price = cost_price
    if (sale_price !== undefined) updateData.sale_price = sale_price

    const { error: updateError } = await supabase
      .from('product_location_data')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('product_id', product_id)
      .eq('location_id', userData.location_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await logUserActivity(supabase, 'precio', 'Edición de precios', {
      product_id,
      cost_price: cost_price ?? null,
      sale_price: sale_price ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}