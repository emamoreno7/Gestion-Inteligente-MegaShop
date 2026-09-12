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

    const { product_id, reason } = await req.json()
    if (!product_id) {
      return NextResponse.json({ error: 'Falta product_id' }, { status: 400 })
    }
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: 'El motivo es obligatorio (mínimo 3 caracteres)' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('deactivate_product', {
      p_product_id: product_id,
      p_reason: reason.trim(),
    })

    if (error) {
      console.error('Error RPC deactivate_product:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en products/deactivate:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}