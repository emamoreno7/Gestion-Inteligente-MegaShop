'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  userName: string
  userInitials: string
  userEmail: string
  locationName: string
  todaySalesFormatted: string
  pendingCount: number
  approvalsCount: number
}

interface AppTile {
  name: string
  href: string
  badge?: number
  gradient: string
  icon: React.ReactNode
}

const svgClass =
  'w-12 h-12 stroke-white fill-none stroke-[1.6] stroke-linecap-round stroke-linejoin-round'

const ICONS = {
  home: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 001 1h3v-6h4v6h3a1 1 0 001-1v-9" />
    </svg>
  ),
  pos: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M8 8V6.5a4 4 0 018 0V8" />
      <path d="M6 8h12l.9 11.2a1.8 1.8 0 01-1.8 1.8H6.9a1.8 1.8 0 01-1.8-1.8z" />
      <path d="M9.5 11v1.2a2.5 2.5 0 005 0V11" />
    </svg>
  ),
  stock: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M12 3l8 4v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </svg>
  ),
  pending: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v4.5M12 15.7v.01" />
    </svg>
  ),
  catalog: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <rect x="4" y="4" width="7.2" height="7.2" rx="1.8" />
      <rect x="12.8" y="4" width="7.2" height="7.2" rx="1.8" />
      <rect x="4" y="12.8" width="7.2" height="7.2" rx="1.8" />
      <rect x="12.8" y="12.8" width="7.2" height="7.2" rx="1.8" />
    </svg>
  ),
  import: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.2 11.2a2 2 0 002 1.6h8.1a2 2 0 002-1.6L20 8H6" />
    </svg>
  ),
  branches: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M4 21h16" />
      <path d="M5 21V10.5L12 4l7 6.5V21" />
      <path d="M10 21v-5.5h4V21" />
      <path d="M9 10.5h.01M15 10.5h.01" />
    </svg>
  ),
  approvals: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  sales: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  settings: (
    <svg className={`${svgClass} stroke-[2.2]`} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5L5.4 5.4" />
    </svg>
  ),
  cash: (
    <svg className={svgClass} viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 9.5h.01M17 14.5h.01" />
    </svg>
  ),
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const email = user.email || 'usuario@megashop.com'

    let rawName = email.split('@')[0]
    let locationId: string | null = null
    let locationName = 'Rivadavia, Mendoza'

    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('full_name, location_id')
        .eq('id', user.id)
        .single()

      if (userRow?.full_name) rawName = userRow.full_name
      if (userRow?.location_id) locationId = userRow.location_id

      if (locationId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', locationId)
          .single()
        if (loc?.name) locationName = loc.name
      }
    } catch {
      // fallback
    }

    const initials = rawName.substring(0, 2).toUpperCase()

    let approvalsCount = 0
    try {
      const { count } = await supabase
        .from('bulk_imports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_approval')
      approvalsCount = count ?? 0
    } catch {
      // no romper
    }

    let pendingCount = 0
    try {
      const { count: noCategoryCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('category_id', null)
      pendingCount += noCategoryCount ?? 0
    } catch {
      // no romper
    }

    try {
      if (locationId) {
        const { count: noPriceCount } = await supabase
          .from('product_location_data')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('price_status', 'pending')
        pendingCount += noPriceCount ?? 0
      }
    } catch {
      // no romper
    }

    let todaySales = 0
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: sales } = await supabase
        .from('sales')
        .select('total, status')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .in('status', ['completed', 'pending'])

      if (sales) {
        todaySales = sales.reduce((sum: number, s: { total: number }) => sum + (s.total || 0), 0)
      }
    } catch {
      // no romper
    }

    const todaySalesFormatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(todaySales)

    setStats({
      userName: rawName,
      userInitials: initials,
      userEmail: email,
      locationName,
      todaySalesFormatted,
      pendingCount,
      approvalsCount,
    })
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-[#3D7373] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-white/80 text-sm font-medium">Cargando dashboard...</span>
        </div>
      </div>
    )
  }

  const modules: AppTile[] = [
    { name: 'Punto de venta', href: '/pos', gradient: 'from-[#F2A65A] to-[#E0783C]', icon: ICONS.pos },
    { name: 'Stock', href: '/stock', gradient: 'from-[#6FB3D9] to-[#3E85B8]', icon: ICONS.stock },
    { name: 'Pendientes', href: '/pending', badge: stats.pendingCount || undefined, gradient: 'from-[#F2C879] to-[#E0A63C]', icon: ICONS.pending },
    { name: 'Catálogo', href: '/catalog', gradient: 'from-[#B99FE0] to-[#8B6BC4]', icon: ICONS.catalog },
    { name: 'Importar', href: '/import', gradient: 'from-[#8FCB9E] to-[#5AA672]', icon: ICONS.import },
    { name: 'Ventas', href: '/sales/history', gradient: 'from-[#6FCBA8] to-[#3E9D7A]', icon: ICONS.sales },
    { name: 'Aprobaciones', href: '/approvals', badge: stats.approvalsCount || undefined, gradient: 'from-[#7FD1C6] to-[#3E9D91]', icon: ICONS.approvals },
    { name: 'Caja', href: '/cash', gradient: 'from-[#F2B3A0] to-[#C96B4E]', icon: ICONS.cash },
    { name: 'Sucursales', href: '/locations', gradient: 'from-[#E88FA3] to-[#C25E78]', icon: ICONS.branches },
    { name: 'Configuración', href: '/settings', gradient: 'from-[#A8AEB8] to-[#767D89]', icon: ICONS.settings },
  ]

  const dockApps = [modules[0], modules[1], modules[3], modules[2], modules[7]]

  const currentDate = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden select-none bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/50 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/45 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/50 blur-[130px]" />
        <div className="absolute bottom-[5%] right-[5%] w-[45rem] h-[40rem] rounded-full bg-[#D2E0A8]/35 blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen px-5 py-6 sm:px-8 md:px-12 lg:px-16 max-w-7xl mx-auto">
        {/* Header Superior */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-white/90 font-semibold text-sm drop-shadow-md">
            <span>📍 {stats.locationName}</span>
            <span className="opacity-50">·</span>
            <span className="capitalize">{currentDate}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-white/20 backdrop-blur-xl border border-white/30 rounded-full py-1.5 pl-1.5 pr-4 shadow-lg">
              <span className="w-8 h-8 rounded-full bg-white text-[#3D7373] flex items-center justify-center font-extrabold text-xs">
                {stats.userInitials}
              </span>
              <div className="hidden sm:block">
                <span className="text-white text-sm font-semibold drop-shadow-sm leading-tight block">{stats.userName}</span>
                <span className="text-white/60 text-[10px] leading-tight block">{stats.userEmail}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-red-500/80 backdrop-blur-xl border border-white/20 hover:border-red-400/50 rounded-full px-3.5 py-2 text-white/80 hover:text-white text-xs font-semibold transition-all duration-200 shadow-lg"
              title="Cerrar sesión"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* 1. Hero Widget */}
        <section className="bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl p-5 sm:p-7 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 shadow-2xl">
          <div>
            <h1 className="text-white text-2xl sm:text-3xl font-extrabold drop-shadow-lg">
              Hola, {stats.userName.split(' ')[0]} 👋
            </h1>
            <p className="text-white/75 text-sm mt-1">Así viene el día en tu sucursal</p>
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-8 items-center">
            <div className="text-center sm:text-right">
              <div className="text-white text-2xl sm:text-3xl font-extrabold drop-shadow-lg tracking-tight">{stats.todaySalesFormatted}</div>
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-widest mt-0.5">Ventas hoy</div>
            </div>
            <div className="h-10 w-px bg-white/20 hidden md:block" />
            <div className="text-center">
              <div className="text-amber-200 text-2xl sm:text-3xl font-extrabold drop-shadow-lg">{stats.pendingCount}</div>
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-widest mt-0.5">Pendientes</div>
            </div>
            <div className="h-10 w-px bg-white/20 hidden md:block" />
            <div className="text-center">
              <div className="text-teal-200 text-2xl sm:text-3xl font-extrabold drop-shadow-lg">{stats.approvalsCount}</div>
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-widest mt-0.5">Aprobaciones</div>
            </div>
          </div>
        </section>

        {/* 2. LOGO CENTRAL (Más grande sin empujar los íconos) */}
        <div className="flex justify-center my-1 sm:my-2">
          <img
            src="/logo-mega-shop.png"
            alt="Mega Shop Rivadavia"
            className="h-32 sm:h-44 md:h-56 lg:h-64 w-auto object-contain filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)] select-none pointer-events-none transition-transform hover:scale-105 duration-300"
          />
        </div>

        {/* 3. Main Grid de Íconos (Más grandes y más arriba) */}
        <main className="flex-1 flex items-start justify-center pt-0 pb-24">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-6 sm:gap-x-10 max-w-5xl w-full justify-items-center">
            {modules.map((app) => (
              <Link key={app.name} href={app.href} className="group flex flex-col items-center gap-3 transition-transform duration-200 active:scale-90 hover:scale-105">
                <div className={`relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-[26px] sm:rounded-[32px] flex items-center justify-center shadow-xl bg-gradient-to-br ${app.gradient} border-t border-white/30 group-hover:shadow-2xl group-hover:brightness-110 transition-all duration-300`}>
                  <div className="scale-110 sm:scale-125 md:scale-135">
                    {app.icon}
                  </div>
                  {typeof app.badge === 'number' && app.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#E0533F] text-white text-xs font-extrabold min-w-[24px] h-[24px] rounded-full flex items-center justify-center border-2 border-white/90 shadow-md animate-pulse">
                      {app.badge}
                    </span>
                  )}
                </div>
                <span className="text-white text-xs sm:text-sm md:text-base font-semibold text-center drop-shadow-md leading-tight max-w-[110px]">{app.name}</span>
              </Link>
            ))}
          </div>
        </main>

        {/* Dock Flotante */}
        <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex gap-3 sm:gap-4 p-2.5 sm:p-3 bg-white/15 backdrop-blur-2xl border border-white/25 rounded-[22px] sm:rounded-3xl shadow-2xl">
            {dockApps.map((item) => (
              <Link key={`dock-${item.name}`} href={item.href} className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${item.gradient} shadow-lg hover:scale-110 active:scale-90 transition-all duration-200 border-t border-white/30`} title={item.name}>
                <div className="scale-75 sm:scale-80">{item.icon}</div>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#E0533F] text-white text-[9px] font-extrabold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-white/80">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}