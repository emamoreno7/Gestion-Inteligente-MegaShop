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
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role_id, location_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })
    }

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single()

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 403 })
    }

    const locationId = userData.location_id || '00000000-0000-0000-0000-000000000001'

    const body = await req.json()
    const { products, importType, fileName } = body

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('import_products', {
      p_products: products,
      p_location_id: locationId,
      p_user_id: user.id,
      p_filename: fileName || 'import',
      p_import_type: importType || 'csv',
      p_role: roleData.name,
    })

    if (error) {
      console.error('Error RPC import_products:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en import/save:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
