'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type StockLevel = {
  location_id: string
  product_id: string
  quantity: number
  product: {
    name: string
    sku: string | null
    barcode: string | null
    category: {
      name: string
    } | null
  }
}

type StockMovement = {
  id: string
  product_id: string
  quantity_change: number
  movement_type: string
  created_at: string
  product: {
    name: string
    sku: string | null
  } | null
  user: {
    full_name: string
  } | null
}

export default function StockPage() {
  const [tab, setTab] = useState<'current' | 'movements'>('current')
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locationName, setLocationName] = useState<string>('Sucursal')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      let locationId: string | null = null
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('location_id')
          .eq('id', user.id)
          .single()

        locationId = userRow?.location_id ?? null

        if (locationId) {
          const { data: loc } = await supabase
            .from('locations')
            .select('name')
            .eq('id', locationId)
            .single()
          if (loc?.name) setLocationName(loc.name)
        }
      } catch {
        // no romper
      }

      if (tab === 'current') {
        let query = supabase
          .from('stock_levels')
          .select(`
            location_id,
            product_id,
            quantity,
            product:products (
              name,
              sku,
              barcode,
              category:categories (name)
            )
          `)
          .order('quantity', { ascending: false })

        if (locationId) {
          query = query.eq('location_id', locationId)
        }

        const { data, error } = await query

        if (!error && data) {
          const normalized = (data as any[]).map((item: any) => ({
            ...item,
            product: Array.isArray(item.product) ? item.product[0] : item.product,
          }))
          setStockLevels(normalized as unknown as StockLevel[])
        } else {
          setStockLevels([])
        }
      } else {
        let query = supabase
          .from('stock_movements')
          .select(`
            id,
            product_id,
            quantity_change,
            movement_type,
            created_at,
            product:products (name, sku),
            user:users (full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(100)

        if (locationId) {
          query = query.eq('location_id', locationId)
        }

        const { data, error } = await query

        if (!error && data) {
          const normalized = (data as any[]).map((item: any) => ({
            ...item,
            product: Array.isArray(item.product) ? item.product[0] : item.product,
            user: Array.isArray(item.user) ? item.user[0] : item.user,
          }))
          setMovements(normalized as unknown as StockMovement[])
        } else if (locationId) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('stock_movements')
            .select(`
              id,
              product_id,
              quantity_change,
              movement_type,
              created_at,
              product:products (name, sku),
              user:users (full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(100)

          if (!fallbackError && fallbackData) {
            const normalized = (fallbackData as any[]).map((item: any) => ({
              ...item,
              product: Array.isArray(item.product) ? item.product[0] : item.product,
              user: Array.isArray(item.user) ? item.user[0] : item.user,
            }))
            setMovements(normalized as unknown as StockMovement[])
          } else {
            setMovements([])
          }
        } else {
          setMovements([])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [tab, supabase])

  const filteredStock = stockLevels.filter(
    (item) =>
      item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      item.product?.barcode?.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnits = filteredStock.reduce((acc, i) => acc + (i.quantity || 0), 0)
  const lowStockCount = filteredStock.filter((i) => i.quantity > 0 && i.quantity <= 5).length
  const outOfStockCount = filteredStock.filter((i) => i.quantity <= 0).length

  const movementTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      sale: 'Venta',
      purchase: 'Compra',
      adjustment: 'Ajuste',
      return: 'Devolución',
      void: 'Anulación',
      transfer_in: 'Transferencia entrada',
      transfer_out: 'Transferencia salida',
      import: 'Importación',
    }
    return map[type] || type
  }

  const qtyBadgeClass = (qty: number) => {
    if (qty <= 0) return 'bg-rose-500/20 text-rose-100 border-rose-300/30'
    if (qty <= 5) return 'bg-amber-400/20 text-amber-100 border-amber-300/30'
    return 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30'
  }

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
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
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
                Stock
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">{locationName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pos"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              POS
            </Link>
            <Link
              href="/catalog"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Catálogo
            </Link>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-fit shadow-lg">
          <button
            onClick={() => setTab('current')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'current'
                ? 'bg-white text-[#2F5E58] shadow-md'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Stock actual
          </button>
          <button
            onClick={() => setTab('movements')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'movements'
                ? 'bg-white text-[#2F5E58] shadow-md'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Movimientos
          </button>
        </div>

        {/* KPIs solo en stock actual */}
        {tab === 'current' && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Productos</div>
              <div className="text-white text-2xl font-extrabold">{filteredStock.length}</div>
            </div>
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Unidades</div>
              <div className="text-white text-2xl font-extrabold">{totalUnits}</div>
            </div>
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Stock bajo</div>
              <div className="text-amber-200 text-2xl font-extrabold">{lowStockCount}</div>
            </div>
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Sin stock</div>
              <div className="text-rose-200 text-2xl font-extrabold">{outOfStockCount}</div>
            </div>
          </div>
        )}

        {/* Buscador (solo stock actual) */}
        {tab === 'current' && (
          <div className="relative mb-4">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/15 backdrop-blur-2xl border border-white/25 text-white placeholder:text-white/50 text-sm sm:text-base font-medium shadow-xl outline-none focus:bg-white/20 focus:border-white/40 transition-all"
            />
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[420px]">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/80 text-sm font-medium">Cargando stock...</span>
              </div>
            </div>
          ) : tab === 'current' ? (
            <div className="overflow-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Producto</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">SKU</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Rubro</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center text-white/60 text-sm">
                        No hay stock registrado.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item) => (
                      <tr
                        key={`${item.location_id}-${item.product_id}`}
                        className="border-b border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="text-white font-semibold text-sm">{item.product?.name || '-'}</div>
                          {item.product?.barcode && (
                            <div className="text-white/45 text-xs mt-0.5">{item.product.barcode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/75">{item.product?.sku || '-'}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/15 text-white/80">
                            {item.product?.category?.name || 'sin rubro'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`inline-flex min-w-[52px] justify-center px-2.5 py-1 rounded-full text-sm font-extrabold border ${qtyBadgeClass(item.quantity)}`}>
                            {item.quantity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Fecha</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Producto</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Tipo</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Cantidad</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-white/60 text-sm">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr
                        key={mov.id}
                        className="border-b border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <td className="px-4 py-3.5 text-sm text-white/70 whitespace-nowrap">
                          {new Date(mov.created_at).toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-white font-semibold text-sm">{mov.product?.name || '-'}</div>
                          {mov.product?.sku && (
                            <div className="text-white/45 text-xs mt-0.5">SKU {mov.product.sku}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/15 text-white/85">
                            {movementTypeLabel(mov.movement_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={`inline-flex min-w-[52px] justify-center px-2.5 py-1 rounded-full text-sm font-extrabold border ${
                              mov.quantity_change >= 0
                                ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30'
                                : 'bg-rose-500/20 text-rose-100 border-rose-300/30'
                            }`}
                          >
                            {mov.quantity_change >= 0 ? '+' : ''}
                            {mov.quantity_change}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/75">
                          {mov.user?.full_name || 'Desconocido'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}