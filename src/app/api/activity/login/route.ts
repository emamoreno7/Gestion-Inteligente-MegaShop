import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, logUserActivity } from '@/lib/activity-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await logUserActivity(supabase, 'login', 'Ingreso al sistema', {})

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}