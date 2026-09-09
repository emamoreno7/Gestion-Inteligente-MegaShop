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

    const { names } = await req.json()
    if (!names || !Array.isArray(names)) {
      return NextResponse.json({ error: 'names es requerido' }, { status: 400 })
    }

    const results: Record<number, any[]> = {}

    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      if (!name) continue

      const { data, error } = await supabase.rpc('find_similar_products', {
        p_name: name,
        p_limit: 3,
      })

      if (!error && data) {
        const filtered = data.filter((item: any) => item.similarity > 0.35)
        if (filtered.length > 0) {
          results[i] = filtered
        }
      }
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}