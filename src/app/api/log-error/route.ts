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

    let locationId: string | null = null
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', user.id)
        .single()
      locationId = userData?.location_id || null
    } catch {}

    const body = await req.json()
    const { message, stack, route, metadata } = body

    if (!message) return NextResponse.json({ error: 'Falta message' }, { status: 400 })

    const { error } = await supabase
      .from('error_logs')
      .insert({
        user_id: user.id,
        location_id: locationId,
        source: 'frontend',
        message,
        stack: stack || null,
        route: route || null,
        metadata: metadata || {},
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}