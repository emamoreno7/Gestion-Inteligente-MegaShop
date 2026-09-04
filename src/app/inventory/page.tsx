'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ProductStock = {
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  stock: number
  min_stock: number
  sale_price: number | null
  cost_price: number | null
}

type PendingCount = {
  id: string
  product_id: string
  product_name: string
  expected_quantity: number
  counted_quantity: number
  difference: number
  created_at: string
  counted_by_name: string | null
}

type ProductOption = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
}

const formatNumber = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export default function InventoryPage() {
  const supabase = useMemo(() => createClient(), [])

  const [tab, setTab] = useState<'stock' | 'counts' | 'adjust'>('stock')
  const [productsStock, setProductsStock] = useState<ProductStock[]>([])
  const [pendingCounts, setPendingCounts] = useState<PendingCount[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Estados de búsqueda y selección para conteos
  const [countProductId, setCountProductId] = useState('')
  const [countProductSearch, setCountProductSearch] = useState('')
  const [showCountOptions, setShowCountOptions] = useState(false)
  const [countedQty, setCountedQty] = useState('')
  const [countNotes, setCountNotes] = useState('')

  // Estados de búsqueda y selección para ajustes
  const [adjustProductId, setAdjustProductId] = useState('')
  const [adjustProductSearch, setAdjustProductSearch] = useState('')
  const [showAdjustOptions, setShowAdjustOptions] = useState(false)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState('ajuste')
  const [adjustNotes, setAdjustNotes] = useState('')

  const [locationId, setLocationId] = useState<string | null>(null)

  const loadInventory = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: userRow, error: userRowError } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()

    if (userRowError) {
      setError('Error al obtener usuario: ' + userRowError.message)
      setLoading(false)
      return
    }

    const locId = userRow?.location_id
    if (!locId) {
      setError('No se pudo determinar la sucursal del usuario')
      setLoading(false)
      return
    }

    setLocationId(locId)

    // Productos con datos comerciales
    const { data: pldData, error: pldError } = await supabase
      .from('product_location_data')
      .select(`
        product_id,
        min_stock,
        sale_price,
        cost_price,
        product:products!inner (
          id,
          name,
          sku,
          barcode
        )
      `)
      .eq('location_id', locId)
      .order('product_id')

    if (pldError) {
      setError(pldError.message)
      setLoading(false)
      return
    }

    // Stock actual
    const { data: stockData, error: stockError } = await supabase
      .from('stock_levels')
      .select('product_id, quantity')
      .eq('location_id', locId)

    if (stockError) {
      setError(stockError.message)
      setLoading(false)
      return
    }

    const stockMap = new Map(stockData.map((s: any) => [s.product_id, s.quantity]))

    const mappedStock: ProductStock[] = (pldData || []).map((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const stock = stockMap.get(item.product_id) ?? 0
      return {
        product_id: item.product_id,
        name: product?.name || 'Sin nombre',
        sku: product?.sku,
        barcode: product?.barcode,
        stock,
        min_stock: item.min_stock ?? 0,
        sale_price: item.sale_price,
        cost_price: item.cost_price,
      }
    })

    setProductsStock(mappedStock)

    // Conteos pendientes
    const { data: pendingData, error: pendingError } = await supabase
      .from('stock_counts')
      .select(`
        id,
        product_id,
        expected_quantity,
        counted_quantity,
        difference,
        created_at,
        product:products!inner(name)
      `)
      .eq('location_id', locId)
      .eq('status', 'pending_adjustment')
      .order('created_at', { ascending: false })

    if (pendingError) {
      setError(pendingError.message)
      setLoading(false)
      return
    }

    const mappedPending: PendingCount[] = (pendingData || []).map((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: product?.name || 'Sin nombre',
        expected_quantity: item.expected_quantity,
        counted_quantity: item.counted_quantity,
        difference: item.difference,
        created_at: item.created_at,
        counted_by_name: null,
      }
    })

    setPendingCounts(mappedPending)

    // Opciones para los buscadores
    setProductOptions(
      mappedStock.map(s => ({
        id: s.product_id,
        name: s.name,
        sku: s.sku,
        barcode: s.barcode,
      }))
    )

    setLoading(false)
  }

  useEffect(() => {
    loadInventory()
  }, [supabase])

  const handleCount = async () => {
    setError(null)
    setSuccess(null)

    if (!countProductId || countedQty === '') {
      setError('Seleccioná producto e ingresá cantidad contada')
      return
    }

    const res = await fetch('/api/inventory/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: countProductId,
        counted_quantity: Number(countedQty),
        notes: countNotes,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al registrar conteo')
    } else {
      setSuccess(`Conteo registrado. Diferencia: ${data.data?.difference}`)
      setCountedQty('')
      setCountNotes('')
      setCountProductId('')
      setCountProductSearch('')
      await loadInventory()
    }
  }

  const handleApplyCount = async (countId: string) => {
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/inventory/apply-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count_id: countId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al aplicar ajuste')
    } else {
      setSuccess('Ajuste de conteo aplicado correctamente')
      await loadInventory()
    }
  }

  const handleAdjust = async () => {
    setError(null)
    setSuccess(null)

    if (!adjustProductId || adjustQty === '' || adjustNotes.trim() === '') {
      setError('Completá producto, cantidad, tipo y motivo')
      return
    }

    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: adjustProductId,
        quantity_change: Number(adjustQty),
        adjustment_type: adjustType,
        notes: adjustNotes,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al registrar ajuste')
    } else {
      setSuccess('Ajuste registrado correctamente')
      setAdjustProductId('')
      setAdjustProductSearch('')
      setAdjustQty('')
      setAdjustNotes('')
      await loadInventory()
    }
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
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
              alt="Logo"
              className="h-9 sm:h-12 w-auto object-contain drop-shadow-md select-none pointer-events-none"
            />

            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">
                Inventario
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">Conteos, ajustes y stock mínimo</p>
            </div>
          </div>
        </header>

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-4 space-y-2">
            {error && <div className="bg-rose-500/20 border border-rose-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium">{error}</div>}
            {success && <div className="bg-emerald-500/20 border border-emerald-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium">{success}</div>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-fit shadow-lg">
          <button
            onClick={() => setTab('stock')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'stock' ? 'bg-white text-[#2F5E58] shadow-md' : 'text-white/80 hover:bg-white/10'}`}
          >
            Stock
          </button>
          <button
            onClick={() => setTab('counts')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'counts' ? 'bg-white text-[#2F5E58] shadow-md' : 'text-white/80 hover:bg-white/10'}`}
          >
            Conteos
          </button>
          <button
            onClick={() => setTab('adjust')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'adjust' ? 'bg-white text-[#2F5E58] shadow-md' : 'text-white/80 hover:bg-white/10'}`}
          >
            Ajustes
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1">
            {/* TAB: STOCK */}
            {tab === 'stock' && (
              <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Producto</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">SKU</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Stock</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Mínimo</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {productsStock.map(p => (
                      <tr key={p.product_id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-white font-semibold text-sm">{p.name}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{p.sku || '-'}</td>
                        <td className="px-4 py-3 text-center text-white text-sm font-bold">{formatNumber(p.stock)}</td>
                        <td className="px-4 py-3 text-center text-white/70 text-sm">{formatNumber(p.min_stock)}</td>
                        <td className="px-4 py-3 text-sm">
                          {p.stock <= 0
                            ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-100 border border-rose-300/30">Sin stock</span>
                            : p.stock <= p.min_stock
                            ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-100 border border-amber-300/30">Bajo</span>
                            : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: CONTEOS */}
            {tab === 'counts' && (
              <div className="space-y-6">
                <div className="relative z-30 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl">
                  <h2 className="text-white text-lg font-extrabold mb-4">Registrar conteo físico</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="relative z-10">
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={countProductId ? productOptions.find(p => p.id === countProductId)?.name || '' : countProductSearch}
                        onChange={(e) => {
                          setCountProductSearch(e.target.value)
                          setShowCountOptions(true)
                          if (e.target.value === '') {
                            setCountProductId('')
                          }
                        }}
                        onFocus={() => setShowCountOptions(true)}
                        className="w-full bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40"
                      />
                      {showCountOptions && (
                        <div className="absolute z-[100] mt-1 w-full max-h-60 overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-white/30 rounded-xl shadow-2xl">
                          {productOptions
                            .filter(p =>
                              p.name.toLowerCase().includes(countProductSearch.toLowerCase()) ||
                              p.sku?.toLowerCase().includes(countProductSearch.toLowerCase()) ||
                              p.barcode?.toLowerCase().includes(countProductSearch.toLowerCase())
                            )
                            .slice(0, 100)
                            .map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setCountProductId(p.id)
                                  setCountProductSearch('')
                                  setShowCountOptions(false)
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white text-sm border-b border-white/5 last:border-0"
                              >
                                <div className="font-semibold">{p.name}</div>
                                {(p.sku || p.barcode) && (
                                  <div className="text-white/50 text-xs">{p.sku || p.barcode}</div>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="Cantidad contada"
                      value={countedQty}
                      onChange={(e) => setCountedQty(e.target.value)}
                      className="bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40"
                    />
                    <input
                      type="text"
                      placeholder="Nota (opcional)"
                      value={countNotes}
                      onChange={(e) => setCountNotes(e.target.value)}
                      className="bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40"
                    />
                  </div>
                  <button
                    onClick={handleCount}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Guardar conteo
                  </button>
                </div>

                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl">
                  <h2 className="text-white text-lg font-extrabold mb-4">Conteos pendientes de ajuste</h2>
                  {pendingCounts.length === 0 ? (
                    <p className="text-white/60 text-sm">No hay conteos pendientes.</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingCounts.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                          <div>
                            <p className="text-white font-bold">{c.product_name}</p>
                            <p className="text-white/60 text-sm">
                              Esperado: {formatNumber(c.expected_quantity)} · Contado: {formatNumber(c.counted_quantity)} · Dif: {formatNumber(c.difference)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleApplyCount(c.id)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                          >
                            Aplicar ajuste
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: AJUSTES */}
            {tab === 'adjust' && (
              <div className="relative z-30 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl">
                <h2 className="text-white text-lg font-extrabold mb-4">Ajuste manual de stock</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="relative z-10">
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={adjustProductId ? productOptions.find(p => p.id === adjustProductId)?.name || '' : adjustProductSearch}
                      onChange={(e) => {
                        setAdjustProductSearch(e.target.value)
                        setShowAdjustOptions(true)
                        if (e.target.value === '') {
                          setAdjustProductId('')
                        }
                      }}
                      onFocus={() => setShowAdjustOptions(true)}
                      className="w-full bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40"
                    />
                    {showAdjustOptions && (
                      <div className="absolute z-[100] mt-1 w-full max-h-60 overflow-y-auto bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl">
                        {productOptions
                          .filter(p =>
                            p.name.toLowerCase().includes(adjustProductSearch.toLowerCase()) ||
                            p.sku?.toLowerCase().includes(adjustProductSearch.toLowerCase()) ||
                            p.barcode?.toLowerCase().includes(adjustProductSearch.toLowerCase())
                          )
                          .slice(0, 100)
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setAdjustProductId(p.id)
                                setAdjustProductSearch('')
                                setShowAdjustOptions(false)
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white text-sm border-b border-white/5 last:border-0"
                            >
                              <div className="font-semibold">{p.name}</div>
                              {(p.sku || p.barcode) && (
                                <div className="text-white/50 text-xs">{p.sku || p.barcode}</div>
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none"
                  >
                    <option value="ajuste" className="text-gray-900">Ajuste</option>
                    <option value="rotura" className="text-gray-900">Rotura</option>
                    <option value="vencimiento" className="text-gray-900">Vencimiento</option>
                    <option value="regalo" className="text-gray-900">Regalo</option>
                    <option value="devolucion_proveedor" className="text-gray-900">Devolución proveedor</option>
                    <option value="otro" className="text-gray-900">Otro</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Cantidad (+/-)"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="bg-white/15 text-white border border-white/20 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40"
                  />
                </div>
                <textarea
                  placeholder="Motivo obligatorio"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full bg-white/15 text-white border border-white/20 rounded-xl px-4 py-3 mb-4 outline-none placeholder:text-white/40"
                  rows={3}
                />
                <button
                  onClick={handleAdjust}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  Registrar ajuste
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}