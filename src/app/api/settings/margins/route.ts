import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
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

    // Verificar que sea owner_admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single()

    if (roleError || roleData?.name !== 'owner_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Obtener todas las categorías y sus márgenes globales
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')

    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

    const { data: margins, error: marginError } = await supabase
      .from('category_margins')
      .select('category_id, margin_pct')
      .is('location_id', null)

    if (marginError) return NextResponse.json({ error: marginError.message }, { status: 500 })

    const marginMap = new Map(margins.map((m: any) => [m.category_id, m.margin_pct]))
    const result = categories.map((c: any) => ({
      category_id: c.id,
      category_name: c.name,
      margin_pct: marginMap.get(c.id) ?? 0,
    }))

    return NextResponse.json({ categories: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single()

    if (roleError || roleData?.name !== 'owner_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { margins } = await req.json()

    if (!margins || !Array.isArray(margins)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    for (const m of margins) {
        // Buscar si ya existe margen global para esta categoría
        const { data: existing } = await supabase
          .from('category_margins')
          .select('id')
          .eq('category_id', m.category_id)
          .is('location_id', null)
          .maybeSingle()
  
        if (existing) {
          const { error } = await supabase
            .from('category_margins')
            .update({ margin_pct: m.margin_pct })
            .eq('id', existing.id)
  
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        } else {
          const { error } = await supabase
            .from('category_margins')
            .insert({
              category_id: m.category_id,
              margin_pct: m.margin_pct,
              location_id: null,
              created_by: user.id,
            })
  
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
  
      return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}