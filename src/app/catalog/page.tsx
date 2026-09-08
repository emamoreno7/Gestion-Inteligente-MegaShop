'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  category_name: string | null
  sale_price: number | null
  cost_price: number | null
  price_status: string | null
  stock: number
}

type Category = {
  id: string
  name: string
}

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'price'>('recent')
  const [editingPrices, setEditingPrices] = useState<Record<string, { cost_price?: number; sale_price?: number; stock?: number }>>({})
  const [role, setRole] = useState<string | null>(null)

  // Para modal de ajuste de stock
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustNewStock, setAdjustNewStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const supabase = useMemo(() => createClient(), [])

  const getMyLocationId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('users')
      .select('location_id, role:roles(name)')
      .eq('id', user.id)
      .single()
    const roleData = Array.isArray(data?.role) ? data.role[0] : data?.role
    setRole(roleData?.name || null)
    return data?.location_id ?? null
  }

  const loadProducts = async () => {
    setLoading(true)
    const locId = await getMyLocationId()
    setLocationId(locId)

    if (!locId) {
      setLoading(false)
      return
    }

    // Categorías
    const { data: catData } = await supabase.from('categories').select('id, name').order('name')
    setCategories(catData || [])

    // Productos con datos comerciales
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, barcode, category_id, created_at,
        category:categories(name),
        product_location_data!inner ( cost_price, sale_price, price_status )
      `)
      .eq('product_location_data.location_id', locId)

    if (error) {
      console.error(error)
    } else {
      const productIds = (data || []).map((row: any) => row.id)

      let stockMap = new Map()
      if (productIds.length > 0) {
        const { data: stockData, error: stockError } = await supabase
          .from('stock_levels')
          .select('product_id, quantity')
          .eq('location_id', locId)
          .in('product_id', productIds)

        if (!stockError && stockData) {
          stockMap = new Map(stockData.map((s: any) => [s.product_id, s.quantity]))
        }
      }

      const mapped: Product[] = (data || []).map((row: any) => {
        const pld = Array.isArray(row.product_location_data)
          ? row.product_location_data[0]
          : row.product_location_data
        const cat = Array.isArray(row.category) ? row.category[0] : row.category

        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category_id: row.category_id,
          category_name: cat?.name || null,
          cost_price: pld?.cost_price ?? null,
          sale_price: pld?.sale_price ?? null,
          price_status: pld?.price_status ?? null,
          stock: stockMap.get(row.id) ?? 0,
        }
      })

      setProducts(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const sku = formData.get('sku') as string
    const barcode = formData.get('barcode') as string
    const sale_price = parseFloat(formData.get('sale_price') as string)
    const cost_price = parseFloat(formData.get('cost_price') as string)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    if (!locationId) {
      alert('No se pudo determinar tu sucursal.')
      setSaving(false)
      return
    }

    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        sku: sku || null,
        barcode: barcode || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (productError || !newProduct) {
      alert('Error al crear producto: ' + productError?.message)
      setSaving(false)
      return
    }

    const { error: pldError } = await supabase
      .from('product_location_data')
      .insert({
        product_id: newProduct.id,
        location_id: locationId,
        sale_price: isNaN(sale_price) ? null : sale_price,
        cost_price: isNaN(cost_price) ? null : cost_price,
        price_status: !isNaN(sale_price) && sale_price > 0 ? 'set' : 'pending',
      })

    if (pldError) {
      alert('Producto creado, pero falló guardar el precio: ' + pldError.message)
    } else {
      form.reset()
      setShowForm(false)
      loadProducts()
    }
    setSaving(false)
  }

  const filteredProducts = products
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = filterCategory === '' || p.category_id === filterCategory
      const matchesStock =
        filterStock === '' ||
        (filterStock === 'low' && p.stock > 0 && p.stock <= 5) ||
        (filterStock === 'out' && p.stock <= 0) ||
        (filterStock === 'ok' && p.stock > 5)
      return matchesSearch && matchesCategory && matchesStock
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'price') return (a.sale_price ?? 0) - (b.sale_price ?? 0)
      return 0
    })

  const handleSavePrice = async (productId: string) => {
    const changes = editingPrices[productId]
    if (!changes || changes.sale_price === undefined) return

    setSaving(true)
    const res = await fetch('/api/catalog/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        sale_price: changes.sale_price,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      alert(data.error || 'Error al guardar precio')
    } else {
      setEditingPrices(prev => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
      loadProducts()
    }
  }

  const handleOpenStockAdjust = (product: Product) => {
    setAdjustProduct(product)
    setAdjustNewStock(String(product.stock))
    setAdjustReason('')
  }

  const handleSaveStockAdjust = async () => {
    if (!adjustProduct) return
    const newStock = parseFloat(adjustNewStock)
    if (isNaN(newStock) || newStock < 0) {
      alert('Stock inválido')
      return
    }
    const reason = adjustReason.trim()
    if (!reason) {
      alert('Debes ingresar un motivo')
      return
    }

    setSaving(true)
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: adjustProduct.id,
        quantity_change: newStock - adjustProduct.stock,
        adjustment_type: 'ajuste',
        notes: reason,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      alert(data.error || 'Error al ajustar stock')
    } else {
      setAdjustProduct(null)
      await loadProducts()
    }
  }

  const canEdit = role === 'owner_admin' || role === 'encargado'

  const statusBadge = (status: string | null) => {
    if (status === 'set') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[10px] font-bold uppercase tracking-wider">Ok</span>
    }
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[10px] font-bold uppercase tracking-wider">Pendiente</span>
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard" className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 text-white hover:bg-white/25 transition-all shadow-lg shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <img src="/logo-mega-shop.png" alt="Logo" className="h-9 sm:h-12 w-auto object-contain drop-shadow-md select-none pointer-events-none" />
            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">Catálogo</h1>
              <p className="text-white/70 text-xs sm:text-sm">Gestión de productos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/import" className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all">Importar</Link>
            <Link href="/stock" className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all">Stock</Link>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>
            </div>
            <input type="text" placeholder="Buscar producto, SKU o código..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-white/50 text-sm font-medium shadow-lg outline-none focus:bg-white/20 focus:border-white/30 transition-all" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs outline-none">
              <option value="" className="text-gray-900">Todos los rubros</option>
              {categories.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>)}
            </select>
            <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)} className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs outline-none">
              <option value="" className="text-gray-900">Todo stock</option>
              <option value="low" className="text-gray-900">Bajo</option>
              <option value="out" className="text-gray-900">Sin stock</option>
              <option value="ok" className="text-gray-900">OK</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs outline-none">
              <option value="recent" className="text-gray-900">Recientes</option>
              <option value="name" className="text-gray-900">Nombre A-Z</option>
              <option value="price" className="text-gray-900">Precio</option>
            </select>
            <button onClick={() => setShowForm(!showForm)} className="px-5 py-3 rounded-2xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white font-extrabold text-sm shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all">
              {showForm ? 'Cancelar' : '+ Agregar producto'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleAddProduct} className="mb-6 bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fade-in-down">
            <h2 className="text-white text-lg font-extrabold mb-4 drop-shadow">Nuevo producto</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div className="space-y-1.5 lg:col-span-3">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Nombre *</label>
                <input name="name" required autoFocus placeholder="Ej: Juego de Sábanas 2 Plazas" className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">SKU</label>
                <input name="sku" placeholder="Código interno" className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Cód. de barras</label>
                <input name="barcode" placeholder="EAN o UPC" className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Precio de Costo</label>
                <input name="cost_price" type="number" step="0.01" placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all" />
              </div>
              <div className="space-y-1.5 lg:col-start-1">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Precio de Venta</label>
                <input name="sale_price" type="number" step="0.01" placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all" />
              </div>
            </div>
            <div className="flex justify-end border-t border-white/15 pt-4">
              <button type="submit" disabled={saving} className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold text-sm shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all">
                {saving ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
              <span className="text-white/80 text-sm font-medium">Cargando catálogo...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7.2" height="7.2" rx="1.8" /><rect x="12.8" y="4" width="7.2" height="7.2" rx="1.8" /><rect x="4" y="12.8" width="7.2" height="7.2" rx="1.8" /><rect x="12.8" y="12.8" width="7.2" height="7.2" rx="1.8" /></svg>
              </div>
              <p className="text-white font-extrabold text-lg">Catálogo vacío</p>
              <p className="text-white/60 text-sm mt-1">No hay productos en esta sucursal.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <p className="text-white font-extrabold text-lg">No hay coincidencias</p>
              <p className="text-white/60 text-sm mt-1">Probá con otros filtros o búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15 z-10">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Nombre</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">SKU / Barcode</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Rubro</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Costo</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Venta</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Stock</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Estado</th>
                    {canEdit && <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const edited = editingPrices[p.id]
                    return (
                      <tr key={p.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="text-white font-semibold text-sm max-w-[250px] sm:max-w-xs truncate" title={p.name}>{p.name}</div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/75">
                          <div className="flex flex-col">
                            {p.sku ? <span>{p.sku}</span> : <span className="text-white/30 italic">Sin SKU</span>}
                            {p.barcode && <span className="text-[10px] text-white/50">{p.barcode}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/15 text-white/80">{p.category_name || 'sin rubro'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-white/80">
                          ${formatMoney(p.cost_price ?? 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-white/70">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={edited?.sale_price ?? p.sale_price ?? ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value)
                                  setEditingPrices(prev => ({ ...prev, [p.id]: { ...prev[p.id], sale_price: isNaN(value) ? undefined : value } }))
                                }}
                                className="w-28 bg-black/20 border border-white/15 text-white rounded-xl px-2 py-1 text-xs text-right"
                              />
                            </div>
                          ) : (
                            <span className="text-white font-extrabold drop-shadow-sm">${formatMoney(p.sale_price ?? 0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {canEdit ? (
                            <button
                              onClick={() => handleOpenStockAdjust(p)}
                              className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-white/10 text-white hover:bg-white/20"
                            >
                              {p.stock}
                            </button>
                          ) : (
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${p.stock <= 0 ? 'bg-rose-500/20 text-rose-100 border-rose-300/30' : p.stock <= 5 ? 'bg-amber-400/20 text-amber-100 border-amber-300/30' : 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30'}`}>{p.stock}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">{statusBadge(p.price_status)}</td>
                        {canEdit && (
                          <td className="px-4 py-3.5 text-right">
                            {edited?.sale_price !== undefined && (
                              <button
                                onClick={() => handleSavePrice(p.id)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-xs font-extrabold shadow border border-white/20 hover:brightness-110"
                              >
                                Guardar precio
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal ajuste de stock */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white text-xl font-extrabold mb-2">Ajustar stock</h2>
            <p className="text-white/70 text-sm mb-4">{adjustProduct.name}</p>
            <label className="block text-[10px] font-bold uppercase text-white/60 mb-1">Nuevo stock</label>
            <input
              type="number"
              min="0"
              value={adjustNewStock}
              onChange={(e) => setAdjustNewStock(e.target.value)}
              className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 mb-3"
            />
            <label className="block text-[10px] font-bold uppercase text-white/60 mb-1">Motivo</label>
            <textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 mb-4"
              rows={2}
              placeholder="Ej: ajuste por inventario"
            />
            <div className="flex gap-3">
              <button onClick={() => setAdjustProduct(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white">Cancelar</button>
              <button onClick={handleSaveStockAdjust} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}