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
  sale_price: number | null
  cost_price: number | null
  price_status: string | null
}

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  
  const supabase = useMemo(() => createClient(), [])

  const getMyLocationId = async (): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('users')
      .select('location_id')
      .eq('id', user.id)
      .single()
    return data?.location_id ?? null
  }

  const loadProducts = async () => {
    setLoading(true)
    const locId = await getMyLocationId()
    setLocationId(locId)

    if (!locId) {
      console.error('No se pudo determinar la sucursal del usuario')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select(
        `
        id, name, sku, barcode, category_id, created_at,
        product_location_data!inner ( cost_price, sale_price, price_status )
      `
      )
      .eq('product_location_data.location_id', locId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      const mapped: Product[] = (data || []).map((row: any) => {
        const pld = Array.isArray(row.product_location_data)
          ? row.product_location_data[0]
          : row.product_location_data
        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category_id: row.category_id,
          cost_price: pld?.cost_price ?? null,
          sale_price: pld?.sale_price ?? null,
          price_status: pld?.price_status ?? null,
        }
      })
      setProducts(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      setSaving(false)
      return
    }

    if (!locationId) {
      alert('No se pudo determinar tu sucursal.')
      setSaving(false)
      return
    }

    // 1. Insertar en products
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
      console.error(productError)
      alert('Error al crear producto: ' + productError?.message)
      setSaving(false)
      return
    }

    // 2. Insertar en product_location_data
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
      console.error(pldError)
      alert('Producto creado, pero falló guardar el precio: ' + pldError.message)
    } else {
      form.reset()
      setShowForm(false)
      loadProducts()
    }
    setSaving(false)
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (status: string | null) => {
    if (status === 'set') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[10px] font-bold uppercase tracking-wider">
          Ok
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[10px] font-bold uppercase tracking-wider">
        Pendiente
      </span>
    )
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      {/* Fondo orgánico */}
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
              alt="Mega Shop Rivadavia"
              className="h-9 sm:h-12 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none pointer-events-none"
            />

            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">
                Catálogo
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">Gestión de productos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/import"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Importar
            </Link>
            <Link
              href="/stock"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Stock
            </Link>
          </div>
        </header>

        {/* Acciones principales */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar producto, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-white/50 text-sm font-medium shadow-lg outline-none focus:bg-white/20 focus:border-white/30 transition-all"
            />
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className={`shrink-0 px-5 py-3 rounded-2xl font-extrabold text-sm shadow-lg border transition-all ${
              showForm
                ? 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                : 'bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white border-white/20 hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {showForm ? 'Cancelar' : '+ Agregar producto'}
          </button>
        </div>

        {/* Formulario de Alta */}
        {showForm && (
          <form
            onSubmit={handleAddProduct}
            className="mb-6 bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fade-in-down"
          >
            <h2 className="text-white text-lg font-extrabold mb-4 drop-shadow">Nuevo producto</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div className="space-y-1.5 lg:col-span-3">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Nombre *</label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="Ej: Juego de Sábanas 2 Plazas"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">SKU</label>
                <input
                  name="sku"
                  placeholder="Código interno"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Cód. de barras</label>
                <input
                  name="barcode"
                  placeholder="EAN o UPC"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Precio de Costo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
                  <input
                    name="cost_price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5 lg:col-start-1">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">Precio de Venta</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
                  <input
                    name="sale_price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/15 focus:border-white/40 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/15 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold text-sm shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {saving ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla de Productos */}
        <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
              <span className="text-white/80 text-sm font-medium">Cargando catálogo...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="7.2" height="7.2" rx="1.8" />
                  <rect x="12.8" y="4" width="7.2" height="7.2" rx="1.8" />
                  <rect x="4" y="12.8" width="7.2" height="7.2" rx="1.8" />
                  <rect x="12.8" y="12.8" width="7.2" height="7.2" rx="1.8" />
                </svg>
              </div>
              <p className="text-white font-extrabold text-lg">Catálogo vacío</p>
              <p className="text-white/60 text-sm mt-1">No hay productos en esta sucursal.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <p className="text-white font-extrabold text-lg">No hay coincidencias</p>
              <p className="text-white/60 text-sm mt-1">Probá buscando con otro nombre o código.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15 z-10">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70 whitespace-nowrap">Nombre</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70 whitespace-nowrap">SKU / Barcode</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70 whitespace-nowrap">Costo</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70 whitespace-nowrap">Venta</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70 whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="text-white font-semibold text-sm max-w-[250px] sm:max-w-xs truncate" title={p.name}>
                          {p.name}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-white/75">
                        <div className="flex flex-col">
                          {p.sku ? <span>{p.sku}</span> : <span className="text-white/30 italic">Sin SKU</span>}
                          {p.barcode && <span className="text-[10px] text-white/50">{p.barcode}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm">
                        {p.cost_price !== null ? (
                          <span className="text-white/80">${formatMoney(p.cost_price)}</span>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {p.sale_price !== null ? (
                          <span className="text-white font-extrabold drop-shadow-sm">${formatMoney(p.sale_price)}</span>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {statusBadge(p.price_status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}