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

    const { sale_id } = await req.json()
    if (!sale_id) return NextResponse.json({ error: 'Falta sale_id' }, { status: 400 })

    const { data, error } = await supabase.rpc('confirm_pending_sale', {
      p_sale_id: sale_id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}