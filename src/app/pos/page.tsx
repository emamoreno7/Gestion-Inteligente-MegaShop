'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number | null
  price_status: string | null
  category: { name: string } | null
}

type CartItem = {
  product: Product
  quantity: number
}

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingPaymentSaleId, setPendingPaymentSaleId] = useState<string | null>(null)
  const [pendingPaymentTotal, setPendingPaymentTotal] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoadingProducts(false)
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', user.id)
        .single()

      const locationId = userRow?.location_id
      if (!locationId) {
        console.error('No se pudo determinar la sucursal del usuario')
        setLoadingProducts(false)
        return
      }

      // Traemos los productos de la sucursal
      const { data } = await supabase
        .from('products')
        .select(
          `
          id,
          name,
          sku,
          barcode,
          category:categories(name),
          product_location_data!inner ( sale_price, price_status, location_id )
        `
        )
        .eq('product_location_data.location_id', locationId)
        .limit(50) // Límite interno, luego filtramos en front

      if (data) {
        const mapped: Product[] = data.map((item: any) => {
          const pld = Array.isArray(item.product_location_data)
            ? item.product_location_data[0]
            : item.product_location_data
          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            barcode: item.barcode,
            sale_price: pld?.sale_price ?? null,
            price_status: pld?.price_status ?? null,
            category: item.category && item.category.length > 0 ? item.category[0] : null,
          }
        })
        setProducts(mapped)
      }
      setLoadingProducts(false)
    }
    loadProducts()
  }, [supabase])

  // Lógica de visualización: Si no hay búsqueda, mostramos solo 10. Si hay, filtramos todos.
  const displayProducts = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku?.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(search.toLowerCase())
      )
    : products.slice(0, 10)

  const addToCart = (product: Product) => {
    if (product.price_status === 'pending') {
      alert(
        'Este producto no tiene precio asignado. Andá a "Pendientes" para asignarle un precio antes de venderlo.'
      )
      return
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setError(null)
    setSuccess(null)
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.product.id !== productId) return item
            const newQty = item.quantity + delta
            if (newQty <= 0) return null
            return { ...item, quantity: newQty }
          })
          .filter(Boolean) as CartItem[]
    )
  }

  const totalCart = cart.reduce(
    (acc, item) => acc + (item.product.sale_price || 0) * item.quantity,
    0
  )
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

  const handleCheckout = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    const items = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.sale_price || 0,
    }))

    const res = await fetch('/api/sales/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        payment_method: paymentMethod,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Error al procesar la venta')
      return
    }

    if (paymentMethod === 'cash') {
      setSuccess(
        `Venta completada. Total: $${formatMoney(data.data.total)}`
      )
      setCart([])
      setSearch('')
    } else {
      setPendingPaymentSaleId(data.data.sale_id)
      setPendingPaymentTotal(data.data.total)
      setCart([])
      setSearch('')
    }
  }

  const handleConfirmPending = async () => {
    if (!pendingPaymentSaleId) return

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: pendingPaymentSaleId }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al confirmar pago')
    } else {
      setSuccess('Pago confirmado. Venta completada.')
      setPendingPaymentSaleId(null)
      setPendingPaymentTotal(0)
    }
  }

  const handleCancelPending = async () => {
    if (!pendingPaymentSaleId) return

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: pendingPaymentSaleId,
        reason: 'Cancelado por cajero',
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al cancelar venta')
    } else {
      setSuccess('Venta cancelada y stock liberado.')
      setPendingPaymentSaleId(null)
      setPendingPaymentTotal(0)
    }
  }

  const paymentOptions = [
    { value: 'cash', label: 'Efectivo', emoji: '💵' },
    { value: 'mercadopago', label: 'Mercado Pago', emoji: '📱' },
    { value: 'transfer', label: 'Transferencia', emoji: '🏦' },
  ]

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      {/* Fondo orgánico */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
              className="h-9 sm:h-12 w-auto object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none pointer-events-none"
            />
            <div className="hidden sm:block pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-xl font-extrabold drop-shadow-lg leading-tight">
                Punto de Venta
              </h1>
              <p className="text-white/70 text-xs">Cobro rápido</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pending"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Pendientes
            </Link>
            <Link
              href="/catalog"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Catálogo
            </Link>
          </div>
        </header>

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-4">
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

        {/* Layout principal: flex-col en móvil/tablet vertical, grid en desktop */}
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-5 gap-4 sm:gap-6 min-h-0">
          
          {/* COLUMNA CARRITO (En móvil va primero gracias a order-1, en LG va a la derecha con order-2) */}
          <section className="order-1 lg:order-2 lg:col-span-2 flex flex-col min-h-0">
            <div className="bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col h-full min-h-[350px] max-h-[50vh] lg:max-h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white text-xl font-extrabold drop-shadow">Carrito</h2>
                  <p className="text-white/65 text-xs mt-0.5">
                    {totalItems === 0 ? 'Sin productos' : `${totalItems} ítem${totalItems === 1 ? '' : 's'}`}
                  </p>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs font-semibold text-white/70 hover:text-rose-200 transition-colors"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {/* Items del Carrito */}
              <div className="flex-1 overflow-y-auto space-y-2.5 mb-4 pr-1">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-14 h-14 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 8V6.5a4 4 0 018 0V8" />
                        <path d="M6 8h12l.9 11.2a1.8 1.8 0 01-1.8 1.8H6.9a1.8 1.8 0 01-1.8-1.8z" />
                      </svg>
                    </div>
                    <p className="text-white/70 text-sm font-medium">Buscá un producto para agregarlo</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="bg-white/10 border border-white/15 rounded-2xl p-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{item.product.name}</p>
                          <p className="text-white/55 text-xs">
                            ${formatMoney(item.product.sale_price || 0)} c/u
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-7 h-7 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-300/20 text-rose-100 flex items-center justify-center transition-all shrink-0"
                          title="Quitar"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-lg font-bold flex items-center justify-center active:scale-95 transition-all"
                          >
                            −
                          </button>
                          <span className="text-white font-extrabold w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-lg font-bold flex items-center justify-center active:scale-95 transition-all"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-white font-extrabold text-sm sm:text-base">
                          ${formatMoney((item.product.sale_price || 0) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total + pago */}
              <div className="border-t border-white/20 pt-4 space-y-4 shrink-0">
                <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-white/75 text-xs sm:text-sm font-semibold uppercase tracking-wider">Total</span>
                  <span className="text-white text-2xl sm:text-3xl font-extrabold drop-shadow-lg tracking-tight">
                    ${formatMoney(totalCart)}
                  </span>
                </div>

                {/* Métodos de pago */}
                <div className="grid grid-cols-3 gap-2">
                  {paymentOptions.map((opt) => {
                    const active = paymentMethod === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentMethod(opt.value)}
                        className={`rounded-2xl px-1 py-2 sm:py-3 text-center border transition-all ${
                          active
                            ? 'bg-white text-[#2F5E58] border-white shadow-lg scale-[1.02]'
                            : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                        }`}
                      >
                        <div className="text-sm sm:text-base leading-none mb-1">{opt.emoji}</div>
                        <div className={`text-[9px] sm:text-[11px] font-bold leading-tight ${active ? 'text-[#2F5E58]' : 'text-white/90'}`}>
                          {opt.label}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || loading}
                  className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-br from-[#F2A65A] to-[#E0783C] text-white text-base sm:text-lg font-extrabold shadow-xl border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Procesando...' : 'Confirmar venta'}
                </button>
              </div>
            </div>
          </section>

          {/* COLUMNA PRODUCTOS (En móvil va abajo con order-2, en LG va a la izquierda con order-1) */}
          <section className="order-2 lg:order-1 lg:col-span-3 flex flex-col min-h-0">
            {/* Buscador */}
            <div className="relative mb-4 shrink-0">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/15 backdrop-blur-2xl border border-white/25 text-white placeholder:text-white/50 text-base font-medium shadow-xl outline-none focus:bg-white/20 focus:border-white/40 transition-all"
              />
            </div>

            {/* Lista de productos */}
            <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <span className="text-white/90 text-sm font-semibold">
                  {loadingProducts 
                    ? 'Cargando productos...' 
                    : search 
                      ? `Resultados de búsqueda (${displayProducts.length})` 
                      : 'Últimos agregados'}
                </span>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-white/70 text-xs font-semibold hover:text-white"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingProducts ? (
                  <div className="h-40 flex items-center justify-center">
                    <div className="w-9 h-9 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : displayProducts.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-white/60 text-sm">
                    No se encontraron productos
                  </div>
                ) : (
                  displayProducts.map((product) => {
                    const isPending = product.price_status === 'pending'
                    const inCartQty =
                      cart.find((c) => c.product.id === product.id)?.quantity || 0

                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={isPending}
                        className={`w-full text-left rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 ${
                          isPending
                            ? 'bg-white/5 border-white/10 opacity-55 cursor-not-allowed'
                            : 'bg-white/10 hover:bg-white/20 border-white/15 hover:border-white/30 hover:scale-[1.01] active:scale-[0.99] shadow-lg'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-white font-semibold text-sm sm:text-base truncate">
                                {product.name}
                              </p>
                              {inCartQty > 0 && (
                                <span className="shrink-0 bg-[#E0533F] text-white text-[10px] font-extrabold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center border border-white/80">
                                  {inCartQty}
                                </span>
                              )}
                            </div>
                            <p className="text-white/55 text-xs truncate">
                              {product.category?.name || 'Sin rubro'}
                              {product.sku ? ` · SKU ${product.sku}` : ''}
                              {product.barcode ? ` · ${product.barcode}` : ''}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            {isPending ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[10px] font-bold">
                                Sin precio
                              </span>
                            ) : (
                              <span className="text-white font-extrabold text-base sm:text-lg drop-shadow">
                                ${formatMoney(product.sale_price || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal MP / Transferencia */}
      {pendingPaymentSaleId && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] flex items-center justify-center shadow-lg border border-white/30">
              <span className="text-2xl">{paymentMethod === 'mercadopago' ? '📱' : '🏦'}</span>
            </div>
            <h2 className="text-white text-xl font-extrabold mb-1 drop-shadow">
              {paymentMethod === 'mercadopago' ? 'Pago con Mercado Pago' : 'Transferencia'}
            </h2>
            <p className="text-white text-3xl font-extrabold mb-2 tracking-tight">
              ${formatMoney(pendingPaymentTotal)}
            </p>
            <p className="text-white/70 text-sm mb-6">¿Confirmás que el cliente ya pagó?</p>

            <button
              onClick={handleConfirmPending}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all mb-2.5"
            >
              Confirmar pago recibido
            </button>
            <button
              onClick={handleCancelPending}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-rose-500/30 border border-white/20 text-white font-semibold transition-all"
            >
              Cancelar venta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}