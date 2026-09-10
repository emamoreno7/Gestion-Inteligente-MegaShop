import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logUserActivity } from '@/lib/activity-server'

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

      const { bulkImportId, surchargePercentage } = await req.json()
      if (!bulkImportId || surchargePercentage === undefined || surchargePercentage === null) {
        return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
      }

      const surcharge = Number(surchargePercentage)
      if (isNaN(surcharge) || surcharge < 0 || surcharge > 100) {
        return NextResponse.json({ error: 'Recargo inválido' }, { status: 400 })
      }

      const { data, error } = await supabase.rpc('approve_bulk_import', {
        p_bulk_import_id: bulkImportId,
        p_surcharge_percentage: surcharge,
      })

    if (error) {
      console.error('Error aprobando import:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logUserActivity(supabase, 'stock', 'Carga de stock aprobada', {
      bulk_import_id: bulkImportId,
      surcharge_percentage: surcharge,
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error en approve:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}