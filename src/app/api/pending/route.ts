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

    // Las 2 queries corren en paralelo
    const [withoutCategoryResult, pldResult] = await Promise.all([
      supabase
        .from('products')
        .select(`id, name, sku, barcode, category_id, category:categories(name)`)
        .is('category_id', null),
      supabase
        .from('product_location_data')
        .select(`
          product_id,
          location_id,
          cost_price,
          sale_price,
          price_status,
          product:products!inner(
            id, name, sku, barcode, category_id,
            category:categories(name)
          )
        `)
        .eq('location_id', locationId),
    ])

    // Validar errores uno a uno (mismo comportamiento que antes)
    if (withoutCategoryResult.error) return NextResponse.json({ error: withoutCategoryResult.error.message }, { status: 500 })
    if (pldResult.error) return NextResponse.json({ error: pldResult.error.message }, { status: 500 })

    const withoutCategory = withoutCategoryResult.data || []
    const allPld = pldResult.data || []

    // Calcular withoutCost (antes query #4)
    const withoutCost = allPld
      .filter((item: any) => 
        (item.cost_price === null || item.cost_price === 0) &&
        item.product?.category_id !== null
      )
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

    // Calcular pendingRecalcCount (antes query #5)
    const pendingRecalcCount = allPld.filter((item: any) =>
      item.price_status === 'pending' &&
      item.cost_price !== null &&
      item.cost_price > 0 &&
      item.product?.category_id !== null
    ).length

    return NextResponse.json({ withoutCategory, withoutCost, pendingRecalcCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}