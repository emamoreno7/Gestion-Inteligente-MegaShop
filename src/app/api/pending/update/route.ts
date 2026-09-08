import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logBackendError } from '@/lib/logger-server'

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

    const { productId, categoryId, costPrice } = await req.json()
    if (!productId) return NextResponse.json({ error: 'Falta productId' }, { status: 400 })

    let rpcName = ''
    let rpcParams: any = {
      p_product_id: productId,
      p_location_id: userData.location_id,
    }

    if (categoryId) {
      rpcName = 'resolve_pending_product'
      rpcParams.p_category_id = categoryId
    } else if (costPrice !== undefined) {
      rpcName = 'resolve_pending_cost'
      rpcParams.p_cost_price = costPrice
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams)

    if (error) {
      console.error(`Error en ${rpcName}:`, error)
      await logBackendError(supabase, error, { route: '/api/pending/update' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en pending/update:', error)

    if (supabase) {
      try {
        await logBackendError(supabase, error, { route: '/api/pending/update' })
      } catch (loggingError) {
        console.error('No se pudo registrar el error:', loggingError)
      }
    }

    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}