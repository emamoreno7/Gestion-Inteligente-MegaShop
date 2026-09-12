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

    const { source_id, target_id, stock_mode } = await req.json()
    if (!source_id || !target_id) {
      return NextResponse.json({ error: 'Faltan source_id o target_id' }, { status: 400 })
    }

    if (source_id === target_id) {
      return NextResponse.json({ error: 'No se puede fusionar un producto consigo mismo' }, { status: 400 })
    }

    const validModes = ['sum', 'keep_max', 'keep_target', 'keep_source']
    const mode = stock_mode && validModes.includes(stock_mode) ? stock_mode : 'keep_max'

    const { data, error } = await supabase.rpc('merge_products', {
      p_source_id: source_id,
      p_target_id: target_id,
      p_stock_mode: mode,
    })

    if (error) {
      console.error('Error RPC merge_products:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en products/merge:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}