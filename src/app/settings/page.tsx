'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type MarginItem = {
  category_id: string
  category_name: string
  margin_pct: number
}

type SectionId =
  | 'business'
  | 'users'
  | 'margins'
  | 'categories'
  | 'payments'
  | 'pos'
  | 'stock'
  | 'ai'
  | 'notifications'
  | 'brand'
  | 'security'
  | 'data'

const SECTIONS: {
  id: SectionId
  label: string
  icon: string
  ready: boolean
  description: string
}[] = [
  { id: 'business', label: 'Negocio', icon: '🏪', ready: false, description: 'Datos fiscales, sucursales y zona horaria' },
  { id: 'users', label: 'Usuarios', icon: '👥', ready: false, description: 'Roles, permisos y accesos' },
  { id: 'margins', label: 'Precios & Márgenes', icon: '💰', ready: true, description: 'Márgenes por rubro y reglas de precio' },
  { id: 'categories', label: 'Rubros', icon: '🏷️', ready: false, description: 'Categorías y palabras clave de IA' },
  { id: 'payments', label: 'Cobros', icon: '💳', ready: false, description: 'Efectivo, MP, transferencias y recargos' },
  { id: 'pos', label: 'Ventas & POS', icon: '🧾', ready: false, description: 'Anulaciones, tickets y reglas de cobro' },
  { id: 'stock', label: 'Stock', icon: '📦', ready: false, description: 'Alertas de stock bajo y conteos' },
  { id: 'ai', label: 'Importaciones & IA', icon: '📥', ready: false, description: 'OCR, clasificación y aprobaciones' },
  { id: 'notifications', label: 'Notificaciones', icon: '🔔', ready: false, description: 'Alertas y reportes automáticos' },
  { id: 'brand', label: 'Marca', icon: '🎨', ready: false, description: 'Logo, colores e identidad visual' },
  { id: 'security', label: 'Seguridad', icon: '🔒', ready: false, description: 'Contraseña, sesiones y 2FA' },
  { id: 'data', label: 'Datos', icon: '📊', ready: false, description: 'Exportaciones y backups' },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('margins')
  const [items, setItems] = useState<MarginItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userName, setUserName] = useState('Usuario')
  const [locationName, setLocationName] = useState('Sucursal')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const load = async () => {
      // Datos de contexto visual (no rompe si falla)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('full_name, location_id')
            .eq('id', user.id)
            .single()

          if (userRow?.full_name) setUserName(userRow.full_name)

          if (userRow?.location_id) {
            const { data: loc } = await supabase
              .from('locations')
              .select('name')
              .eq('id', userRow.location_id)
              .single()
            if (loc?.name) setLocationName(loc.name)
          }
        }
      } catch {
        // no bloquear settings
      }

      // Lógica real existente
      const res = await fetch('/api/settings/margins')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al cargar márgenes')
      } else {
        setItems(data.categories || [])
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/settings/margins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ margins: items }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Error al guardar')
    } else {
      setSuccess('Márgenes actualizados correctamente.')
    }
  }

  const activeMeta = SECTIONS.find((s) => s.id === activeSection)!

  const ComingSoon = ({
    title,
    description,
    bullets,
  }: {
    title: string
    description: string
    bullets: string[]
  }) => (
    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-bold uppercase tracking-wider mb-3">
            Próximamente
          </div>
          <h2 className="text-white text-xl sm:text-2xl font-extrabold drop-shadow">{title}</h2>
          <p className="text-white/70 text-sm mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {bullets.map((b) => (
          <div
            key={b}
            className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white/80 text-sm font-medium"
          >
            {b}
          </div>
        ))}
      </div>

      <p className="text-white/45 text-xs mt-5">
        Esta sección ya está diseñada a nivel elite. Se conectará cuando exista la lógica de backend correspondiente.
      </p>
    </div>
  )

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      {/* Fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 text-white hover:bg-white/25 transition-all shadow-lg shrink-0"
              title="Volver al inicio"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>

            <img
              src="/logo-mega-shop.png"
              alt="Mega Shop Rivadavia"
              className="h-9 sm:h-12 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none pointer-events-none"
            />

            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">
                Configuración
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">
                {userName} · {locationName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/catalog"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Catálogo
            </Link>
            <Link
              href="/pending"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Pendientes
            </Link>
          </div>
        </header>

        {/* Layout settings */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-0">
          {/* Sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 sm:p-4 shadow-xl sticky top-4">
              <div className="px-2 pb-3 mb-2 border-b border-white/10">
                <p className="text-white/50 text-[11px] font-bold uppercase tracking-wider">
                  Panel de control
                </p>
              </div>

              <nav className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {SECTIONS.map((section) => {
                  const active = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id)
                        setError(null)
                        setSuccess(null)
                      }}
                      className={`w-full text-left rounded-2xl px-3.5 py-3 border transition-all ${
                        active
                          ? 'bg-white text-[#2F5E58] border-white shadow-md'
                          : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{section.icon}</span>
                          <div className="min-w-0">
                            <div className={`text-sm font-extrabold truncate ${active ? 'text-[#2F5E58]' : 'text-white'}`}>
                              {section.label}
                            </div>
                            <div className={`text-[11px] truncate ${active ? 'text-[#2F5E58]/70' : 'text-white/55'}`}>
                              {section.description}
                            </div>
                          </div>
                        </div>

                        {section.ready ? (
                          <span
                            className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20'
                                : 'bg-emerald-400/15 text-emerald-100 border-emerald-300/25'
                            }`}
                          >
                            Activo
                          </span>
                        ) : (
                          <span
                            className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${
                              active
                                ? 'bg-black/5 text-[#2F5E58]/70 border-black/10'
                                : 'bg-white/10 text-white/55 border-white/15'
                            }`}
                          >
                            Soon
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-8 xl:col-span-9 min-h-0">
            {/* Title card */}
            <div className="bg-white/12 backdrop-blur-2xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-xl mb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{activeMeta.icon}</span>
                    <h2 className="text-white text-xl sm:text-2xl font-extrabold drop-shadow">
                      {activeMeta.label}
                    </h2>
                  </div>
                  <p className="text-white/70 text-sm">{activeMeta.description}</p>
                </div>

                {activeMeta.ready ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[11px] font-extrabold uppercase tracking-wider">
                    Módulo operativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/70 text-[11px] font-extrabold uppercase tracking-wider">
                    En diseño / pendiente de backend
                  </span>
                )}
              </div>
            </div>

            {/* Alerts only for active functional module */}
            {activeSection === 'margins' && (error || success) && (
              <div className="mb-4 space-y-2">
                {error && (
                  <div className="bg-rose-500/20 backdrop-blur-xl border border-rose-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">
                    {success}
                  </div>
                )}
              </div>
            )}

            {/* ===== SECCIÓN REAL: MÁRGENES ===== */}
            {activeSection === 'margins' && (
              <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-white font-extrabold text-base sm:text-lg">Márgenes por rubro</h3>
                    <p className="text-white/60 text-xs mt-0.5">
                      Estos % se usan para calcular precio de venta al cargar costos.
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving || loading || items.length === 0}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-sm font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {saving ? 'Guardando...' : 'Guardar márgenes'}
                  </button>
                </div>

                {loading ? (
                  <div className="p-10 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                    <span className="text-white/80 text-sm font-medium">Cargando márgenes...</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-white font-extrabold text-lg">Sin rubros configurados</p>
                    <p className="text-white/60 text-sm mt-1">No hay categorías para asignar márgenes.</p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 space-y-2.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.category_id}
                        className="rounded-2xl bg-white/10 border border-white/15 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-white/15 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm sm:text-base truncate">
                            {item.category_name}
                          </div>
                          <div className="text-white/50 text-xs mt-0.5">
                            Margen aplicado al costo para calcular precio de venta
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.margin_pct}
                              onChange={(e) => {
                                const updated = [...items]
                                updated[idx] = {
                                  ...updated[idx],
                                  margin_pct: parseFloat(e.target.value) || 0,
                                }
                                setItems(updated)
                              }}
                              className="w-28 sm:w-32 pl-3 pr-8 py-2.5 rounded-xl bg-black/20 border border-white/20 text-white font-extrabold text-sm outline-none focus:border-white/40 focus:bg-black/30 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 text-sm font-bold">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10 mt-2">
                      <p className="text-white/55 text-xs">
                        Tip: un margen de 40% sobre costo $100 genera precio de venta $140.
                      </p>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-sm font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all"
                      >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== PLACEHOLDERS ELITE ===== */}
            {activeSection === 'business' && (
              <ComingSoon
                title="Negocio & Sucursales"
                description="Identidad comercial, datos fiscales y multi-sucursal."
                bullets={[
                  'Razón social, CUIT y domicilio fiscal',
                  'Alta/edición de sucursales',
                  'Zona horaria y moneda (ARS)',
                  'Datos de contacto y ticket footer',
                ]}
              />
            )}

            {activeSection === 'users' && (
              <ComingSoon
                title="Usuarios & Roles"
                description="Control de accesos estilo SaaS enterprise."
                bullets={[
                  'Invitar usuarios por email',
                  'Roles: owner, admin, encargado, cajero',
                  'Permisos granulares por módulo',
                  'Historial de sesiones y auditoría',
                ]}
              />
            )}

            {activeSection === 'categories' && (
              <ComingSoon
                title="Rubros & Clasificación"
                description="Taxonomía del catálogo + motor de keywords IA."
                bullets={[
                  'CRUD de rubros',
                  'Keywords del clasificador híbrido',
                  'Reglas de prioridad por categoría',
                  'Mapeo de slugs y normalización',
                ]}
              />
            )}

            {activeSection === 'payments' && (
              <ComingSoon
                title="Cobros & Medios de pago"
                description="Configuración de caja y pasarelas."
                bullets={[
                  'Habilitar Efectivo / MP / Transferencia',
                  'Credenciales Mercado Pago',
                  'CBU/Alias para transferencias',
                  'Recargos por método de pago',
                ]}
              />
            )}

            {activeSection === 'pos' && (
              <ComingSoon
                title="Ventas & POS"
                description="Reglas operativas del mostrador."
                bullets={[
                  'Umbral de anulación con motivo',
                  'Venta sin stock (permitir/bloquear)',
                  'Impresión automática de ticket',
                  'Redondeo de efectivo',
                ]}
              />
            )}

            {activeSection === 'stock' && (
              <ComingSoon
                title="Stock & Alertas"
                description="Semáforos y control de inventario."
                bullets={[
                  'Umbral de stock bajo',
                  'Alertas de sin stock',
                  'Conteos físicos programados',
                  'Política de ajustes manuales',
                ]}
              />
            )}

            {activeSection === 'ai' && (
              <ComingSoon
                title="Importaciones & IA"
                description="OCR, clasificación y gobernanza de cargas."
                bullets={[
                  'Modelo OCR (Groq Vision)',
                  'Modelo de clasificación textual',
                  'Aprobación obligatoria de bulk import',
                  'Umbral de ítems para revisión humana',
                ]}
              />
            )}

            {activeSection === 'notifications' && (
              <ComingSoon
                title="Notificaciones"
                description="Alertas operativas y reportes."
                bullets={[
                  'Email de alertas del local',
                  'Aviso de aprobaciones pendientes',
                  'Reporte diario de ventas',
                  'Alertas de stock crítico',
                ]}
              />
            )}

            {activeSection === 'brand' && (
              <ComingSoon
                title="Marca & Apariencia"
                description="Identidad visual del sistema."
                bullets={[
                  'Logo principal',
                  'Color primario de marca',
                  'Modo claro/oscuro',
                  'Favicon y naming de tickets',
                ]}
              />
            )}

            {activeSection === 'security' && (
              <ComingSoon
                title="Seguridad"
                description="Protección de cuenta y accesos."
                bullets={[
                  'Cambio de contraseña',
                  'Sesiones activas',
                  'Cierre remoto de sesión',
                  '2FA (futuro)',
                ]}
              />
            )}

            {activeSection === 'data' && (
              <ComingSoon
                title="Datos & Backups"
                description="Exportación y resguardo de información."
                bullets={[
                  'Exportar productos / ventas / stock',
                  'Backups programados',
                  'Descarga de auditoría',
                  'Zona de peligro (solo owner)',
                ]}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}