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
    const { products, merges, importType, fileName, sourceHash, surchargePercentage } = body

    // Validar que al menos uno de los arrays tenga elementos
    if (
      (!products || !Array.isArray(products) || products.length === 0) &&
      (!merges || !Array.isArray(merges) || merges.length === 0)
    ) {
      return NextResponse.json({ error: 'No hay productos ni fusiones para guardar' }, { status: 400 })
    }

    // Llamar a la nueva RPC con 7 parámetros
    const { data, error } = await supabase.rpc('import_products', {
      p_products: products || [],
      p_location_id: locationId,
      p_filename: fileName || 'import',
      p_import_type: importType || 'csv',
      p_source_hash: sourceHash || null,
      p_surcharge_percentage: surchargePercentage ?? null,
      p_merges: merges || [],
    })

    if (error) {
      console.error('Error RPC import_products:', error)
      await logBackendError(supabase, error, { route: '/api/import/save' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'stock', 'Carga de stock', {
      products_count: products?.length || 0,
      merges_count: merges?.length || 0,
      file_name: fileName || null,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en import/save:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/import/save' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}