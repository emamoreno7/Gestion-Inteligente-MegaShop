import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    // 1) Productos sin rubro
    const { data: withoutCategory, error: catError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        barcode,
        category_id,
        category:categories(name)
      `)
      .is('category_id', null)

    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

    // 2) Productos con rubro pero sin costo en esta sucursal
    const { data: withoutCostRaw, error: costError } = await supabase
      .from('product_location_data')
      .select(`
        product_id,
        location_id,
        cost_price,
        sale_price,
        price_status,
        product:products!inner(
          id,
          name,
          sku,
          barcode,
          category_id,
          category:categories(name)
        )
      `)
      .eq('location_id', locationId)
      .or('cost_price.is.null,cost_price.eq.0')

    if (costError) return NextResponse.json({ error: costError.message }, { status: 500 })

    const withoutCost = (withoutCostRaw || [])
      .filter((item: any) => item.product?.category_id !== null)
      .map((item: any) => ({
        id: item.product?.id,
        product_id: item.product_id,
        name: item.product?.name,
        sku: item.product?.sku,
        barcode: item.product?.barcode,
        category_id: item.product?.category_id,
        category: item.product?.category,
        cost_price: item.cost_price,
        sale_price: item.sale_price,
        price_status: item.price_status,
      }))

    // 3) Pendientes de recálculo: rubro + costo + price_status = 'pending'
    const { data: pendingRecalcRaw, error: recalcError } = await supabase
      .from('product_location_data')
      .select(`
        product_id,
        location_id,
        cost_price,
        sale_price,
        price_status,
        product:products!inner(
          id,
          name,
          sku,
          barcode,
          category_id,
          category:categories(name)
        )
      `)
      .eq('location_id', locationId)
      .eq('price_status', 'pending')
      .gt('cost_price', 0)

    if (recalcError) return NextResponse.json({ error: recalcError.message }, { status: 500 })

    const pendingRecalcCount = (pendingRecalcRaw || []).filter(
      (item: any) => item.product?.category_id !== null
    ).length

    return NextResponse.json({
      withoutCategory: withoutCategory || [],
      withoutCost,
      pendingRecalcCount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}