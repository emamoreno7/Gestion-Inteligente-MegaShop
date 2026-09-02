'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

type Sale = {
  id: string
  total: number
  status: string
  created_at: string
  user: { full_name: string } | null
}

type SaleItem = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  product: { name: string; sku: string | null } | null
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  const [saleItemsMap, setSaleItemsMap] = useState<Record<string, SaleItem[]>>({})
  const [salePaymentsMap, setSalePaymentsMap] = useState<Record<string, any[]>>({})
  const [saleMovementsMap, setSaleMovementsMap] = useState<Record<string, any[]>>({})
  const [voidSaleId, setVoidSaleId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnItems, setReturnItems] = useState<Record<string, number>>({})
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const supabase = createClient()

  const loadSales = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('id, total, status, created_at, user_id')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const userIds = Array.from(new Set((data || []).map((s: any) => s.user_id).filter(Boolean)))

    let userMap = new Map()
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds)
      userMap = new Map((usersData || []).map((u: any) => [u.id, u.full_name]))
    }

    const mapped = (data || []).map((sale: any) => ({
      id: sale.id,
      total: sale.total,
      status: sale.status,
      created_at: sale.created_at,
      user: userMap.has(sale.user_id)
        ? { full_name: userMap.get(sale.user_id) }
        : null,
    }))

    setSales(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadSales()
  }, [])

  const loadSaleItems = async (saleId: string) => {
    if (saleItemsMap[saleId]) return

    const { data, error } = await supabase
      .from('sale_items')
      .select('id, product_id, quantity, unit_price')
      .eq('sale_id', saleId)

    if (!error && data) {
      const productIds = Array.from(new Set((data as any[]).map(item => item.product_id).filter(Boolean)))

      let productMap = new Map()
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, sku')
          .in('id', productIds)
        productMap = new Map((productsData || []).map((p: any) => [p.id, p]))
      }

      const mapped = (data as any[]).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product: productMap.has(item.product_id)
          ? { name: productMap.get(item.product_id).name, sku: productMap.get(item.product_id).sku }
          : null,
      }))

      setSaleItemsMap(prev => ({ ...prev, [saleId]: mapped as SaleItem[] }))
    }
  }

  const loadSalePayments = async (saleId: string) => {
    if (salePaymentsMap[saleId]) return
    const { data, error } = await supabase
      .from('payments')
      .select('method, amount, created_at, status')
      .eq('sale_id', saleId)
    if (!error && data) {
      setSalePaymentsMap(prev => ({ ...prev, [saleId]: data }))
    }
  }

  const loadSaleMovements = async (saleId: string) => {
    if (saleMovementsMap[saleId]) return

    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, quantity_change, movement_type, created_at, notes, product_id, performed_by')
      .eq('reference_id', saleId)
      .in('movement_type', ['return', 'void', 'cancel'])
      .order('created_at', { ascending: false })

    if (!error && data) {
      const productIds = Array.from(new Set((data as any[]).map(m => m.product_id).filter(Boolean)))
      const userIds = Array.from(new Set((data as any[]).map(m => m.performed_by).filter(Boolean)))

      let productMap = new Map()
      let userMap = new Map()

      if (productIds.length > 0) {
        const { data: prodData } = await supabase.from('products').select('id, name').in('id', productIds)
        productMap = new Map((prodData || []).map((p: any) => [p.id, p.name]))
      }

      if (userIds.length > 0) {
        const { data: userData } = await supabase.from('users').select('id, full_name').in('id', userIds)
        userMap = new Map((userData || []).map((u: any) => [u.id, u.full_name]))
      }

      const mapped = (data as any[]).map((mov: any) => ({
        ...mov,
        product: productMap.has(mov.product_id) ? { name: productMap.get(mov.product_id) } : null,
        user: userMap.has(mov.performed_by) ? { full_name: userMap.get(mov.performed_by) } : null,
      }))

      setSaleMovementsMap(prev => ({ ...prev, [saleId]: mapped }))
    }
  }

  const toggleExpand = (saleId: string) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null)
    } else {
      setExpandedSaleId(saleId)
      loadSaleItems(saleId)
      loadSalePayments(saleId)
      loadSaleMovements(saleId)
    }
  }

  const handleVoid = async () => {
    if (!voidSaleId || !voidReason.trim()) {
      setError('El motivo es obligatorio')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: voidSaleId, reason: voidReason }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al anular venta')
    } else {
      setSuccess(`Venta anulada. Movimientos generados: ${data.data.movements_created}`)
      setVoidSaleId(null)
      setVoidReason('')
      await loadSales()
    }
  }

  const handleConfirmPayment = async (saleId: string) => {
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: saleId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al confirmar pago')
    } else {
      setSuccess('Pago confirmado correctamente')
      await loadSales()
    }
  }

  const handleCancelPending = async () => {
    if (!cancelSaleId || !cancelReason.trim()) {
      setError('El motivo es obligatorio')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: cancelSaleId, reason: cancelReason }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al cancelar venta')
    } else {
      setSuccess('Venta pendiente cancelada y stock liberado')
      setCancelSaleId(null)
      setCancelReason('')
      await loadSales()
    }
  }

  const handleReturn = async () => {
    if (!returnSaleId || !returnReason.trim()) {
      setError('El motivo es obligatorio')
      return
    }

    const items = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        product_id: productId,
        quantity,
      }))

    if (items.length === 0) {
      setError('Seleccioná al menos un ítem con cantidad')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/sales/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: returnSaleId, items, reason: returnReason }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al procesar devolución')
    } else {
      setSuccess(`Devolución procesada. Movimientos generados: ${data.data.movements_created}`)
      setReturnSaleId(null)
      setReturnReason('')
      setReturnItems({})
      await loadSales()
    }
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Historial de ventas</h1>

          {error && <div className="text-red-400 mb-4">{error}</div>}
          {success && <div className="text-green-400 mb-4">{success}</div>}

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : sales.length === 0 ? (
            <div className="bg-gray-800 rounded p-6 text-center text-gray-400">
              No hay ventas registradas.
            </div>
          ) : (
            <div className="space-y-4">
              {sales.map(sale => (
                <div key={sale.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  <div className="p-4 cursor-pointer" onClick={() => toggleExpand(sale.id)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">
                          Venta {sale.id.slice(0, 8)} · {new Date(sale.created_at).toLocaleString('es-AR')}
                        </p>
                        <p className="text-sm text-gray-400">
                          Total: ${sale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} · Estado: {sale.status} · Vendedor: {sale.user?.full_name || 'Desconocido'}
                        </p>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {sale.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmPayment(sale.id)}
                              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Confirmar pago
                            </button>
                            <button
                              onClick={() => setCancelSaleId(sale.id)}
                              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setVoidSaleId(sale.id)}
                          disabled={sale.status === 'voided' || sale.status === 'pending'}
                          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Anular
                        </button>
                        <button
                          onClick={() => {
                            setReturnSaleId(sale.id)
                            loadSaleItems(sale.id)
                          }}
                          disabled={sale.status === 'voided' || sale.status === 'pending'}
                          className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          Devolver
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedSaleId === sale.id && saleItemsMap[sale.id] && (
                    <div className="border-t border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">Ítems vendidos</h3>
                      <div className="space-y-2">
                        {saleItemsMap[sale.id].map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-200">
                              {item.product?.name || 'Producto'} ({item.quantity} x ${item.unit_price.toLocaleString('es-AR')})
                            </span>
                            <span className="text-gray-400">
                              ${(item.quantity * item.unit_price).toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {salePaymentsMap[sale.id] && salePaymentsMap[sale.id].length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-300 mb-1">Pago</h4>
                          {salePaymentsMap[sale.id].map((payment: any, idx: number) => (
                            <div key={idx} className="text-sm text-gray-400">
                              Método: {payment.method} · Estado: {payment.status} · Monto: ${payment.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })} · {new Date(payment.created_at).toLocaleString('es-AR')}
                            </div>
                          ))}
                        </div>
                      )}

                      {saleMovementsMap[sale.id] && saleMovementsMap[sale.id].length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-300 mb-1">Devoluciones / Anulaciones / Cancelaciones</h4>
                          <div className="space-y-1">
                            {saleMovementsMap[sale.id].map((mov: any) => (
                              <div key={mov.id} className={`text-sm ${mov.movement_type === 'return' ? 'text-yellow-400' : mov.movement_type === 'cancel' ? 'text-orange-400' : 'text-red-400'}`}>
                                {mov.movement_type === 'return' ? 'Devolución' : mov.movement_type === 'cancel' ? 'Cancelación' : 'Anulación'} · {mov.product?.name || 'Producto'} · Cant: {mov.quantity_change} · Motivo: {mov.notes} · {new Date(mov.created_at).toLocaleString('es-AR')} · {mov.user?.full_name || 'Usuario'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Anular */}
        {voidSaleId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold text-white mb-4">Anular venta</h2>
              <p className="text-gray-300 mb-4">Ingresá el motivo de anulación:</p>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 mb-4"
                rows={3}
                placeholder="Motivo..."
              />
              <div className="flex gap-4">
                <button
                  onClick={handleVoid}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirmar anulación
                </button>
                <button
                  onClick={() => setVoidSaleId(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Devolución */}
        {returnSaleId && saleItemsMap[returnSaleId] && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-white mb-4">Devolver ítems</h2>
              <p className="text-gray-300 mb-4">Seleccioná cantidades a devolver y el motivo:</p>
              <div className="space-y-3 mb-4">
                {saleItemsMap[returnSaleId].map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-white text-sm">{item.product?.name || 'Producto'}</p>
                      <p className="text-gray-400 text-xs">Vendido: {item.quantity}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={returnItems[item.product_id] || 0}
                      onChange={(e) => {
                        const qty = Math.min(parseInt(e.target.value) || 0, item.quantity)
                        setReturnItems(prev => ({ ...prev, [item.product_id]: qty }))
                      }}
                      className="w-20 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                    />
                  </div>
                ))}
              </div>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 mb-4"
                rows={3}
                placeholder="Motivo de devolución..."
              />
              <div className="flex gap-4">
                <button
                  onClick={handleReturn}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Procesar devolución
                </button>
                <button
                  onClick={() => setReturnSaleId(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Cancelar pendiente */}
        {cancelSaleId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold text-white mb-4">Cancelar venta pendiente</h2>
              <p className="text-gray-300 mb-4">Ingresá el motivo de cancelación:</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 mb-4"
                rows={3}
                placeholder="Motivo..."
              />
              <div className="flex gap-4">
                <button
                  onClick={handleCancelPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirmar cancelación
                </button>
                <button
                  onClick={() => setCancelSaleId(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}