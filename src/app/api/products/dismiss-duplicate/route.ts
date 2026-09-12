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

    const { a_id, b_id } = await req.json()
    if (!a_id || !b_id) {
      return NextResponse.json({ error: 'Faltan a_id o b_id' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('dismiss_duplicate', {
      p_a_id: a_id,
      p_b_id: b_id,
    })

    if (error) {
      console.error('Error RPC dismiss_duplicate:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en products/dismiss-duplicate:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}