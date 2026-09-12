import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url)
    const minSimilarity = parseFloat(url.searchParams.get('min_similarity') || '0.55')
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)

    const { data, error } = await supabase.rpc('find_duplicate_pairs', {
      p_location_id: userData.location_id,
      p_min_similarity: minSimilarity,
      p_limit: limit,
    })

    if (error) {
      console.error('Error RPC find_duplicate_pairs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pairs: data || [] })
  } catch (error: any) {
    console.error('Error en products/duplicates:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}