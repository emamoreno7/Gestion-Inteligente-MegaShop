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

    const { bulkImportId } = await req.json()
    if (!bulkImportId) return NextResponse.json({ error: 'Falta bulkImportId' }, { status: 400 })

    const { data, error } = await supabase.rpc('approve_bulk_import', {
      p_bulk_import_id: bulkImportId,
      p_user_id: user.id,
    })

    if (error) {
      console.error('Error aprobando import:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en approve:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}