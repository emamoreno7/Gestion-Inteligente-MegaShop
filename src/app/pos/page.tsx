'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

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

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingPaymentSaleId, setPendingPaymentSaleId] = useState<string | null>(null)
  const [pendingPaymentTotal, setPendingPaymentTotal] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const loadProducts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userRow } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', user.id)
        .single()

      const locationId = userRow?.location_id
      if (!locationId) {
        console.error('No se pudo determinar la sucursal del usuario')
        return
      }

      const { data } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          barcode,
          category:categories(name),
          product_location_data!inner ( sale_price, price_status, location_id )
        `)
        .eq('product_location_data.location_id', locationId)
        .limit(50)

      if (data) {
        const mapped: Product[] = data.map((item: any) => {
          const pld = Array.isArray(item.product_location_data) ? item.product_location_data[0] : item.product_location_data
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
    }
    loadProducts()
  }, [])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (product: Product) => {
    if (product.price_status === 'pending') {
      alert('Este producto no tiene precio asignado. Andá a "Pendientes" para asignarle un precio antes de venderlo.')
      return
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
       )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item
      const newQty = item.quantity + delta
      if (newQty <= 0) return null
      return { ...item, quantity: newQty }
    }).filter(Boolean) as CartItem[])
  }

  const totalCart = cart.reduce((acc, item) => acc + ((item.product.sale_price || 0) * item.quantity), 0)

  const handleCheckout = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    const items = cart.map(item => ({
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

    // Para Mercado Pago: la venta queda pendiente, no abrimos link
    // El pago se confirmará manualmente desde el historial (demo)

    if (paymentMethod === 'cash') {
      setSuccess(`Venta completada. Total: $${data.data.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
      setCart([])
      setSearch('')
    } else {
      setPendingPaymentSaleId(data.data.sale_id)
      setPendingPaymentTotal(data.data.total)
      setCart([])
      setSearch('')
    }
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-4">Punto de Venta</h1>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded mb-4"
            />
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`w-full text-left p-3 rounded ${product.price_status === 'pending' ? 'bg-gray-800 opacity-50 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between">
                    <span className="text-white">{product.name}</span>
                    <span className="text-gray-300">
                      {product.price_status === 'pending' ? 'Sin precio' : `$${product.sale_price?.toLocaleString('es-AR')}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 h-fit">
            <h2 className="text-xl font-semibold text-white mb-4">Carrito</h2>
            {cart.length === 0 ? (
              <p className="text-gray-400">Sin productos</p>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex justify-between items-center">
                    <div>
                      <p className="text-white">{item.product.name}</p>
                      <p className="text-sm text-gray-400">${item.product.sale_price?.toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="px-2 bg-gray-700 rounded">-</button>
                      <span className="text-white">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="px-2 bg-gray-700 rounded">+</button>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 ml-2">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-700 pt-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Total</span>
                <span className="text-white font-bold">${totalCart.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              <select
                value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded mb-4"
              >
                <option value="cash">Efectivo</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="transfer">Transferencia</option>
              </select>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || loading}
                className="w-full py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Confirmar venta'}
              </button>
            </div>

            {error && <div className="mt-4 text-red-400">{error}</div>}
            {success && <div className="mt-4 text-green-400">{success}</div>}
            {pendingPaymentSaleId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Pago con Mercado Pago</h2>
            <p className="text-gray-300 mb-4">Total: ${pendingPaymentTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://mercadopago.com.ar/${pendingPaymentSaleId}`)}`}
              alt="QR de pago"
              className="mx-auto mb-4"
            />
            <button
              onClick={async () => {
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
              }}
              className="w-full py-3 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Ya pagó, confirmar
            </button>
            <button
              onClick={() => {
                setPendingPaymentSaleId(null)
                setPendingPaymentTotal(0)
                setError('Pago cancelado por el cliente')
              }}
              className="mt-2 w-full py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </>
  )
}
