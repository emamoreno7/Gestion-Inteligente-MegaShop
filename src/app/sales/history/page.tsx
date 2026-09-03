'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  
  const [locationName, setLocationName] = useState('Cargando...')
  const supabase = useMemo(() => createClient(), [])

  const loadSales = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    let locId = null
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', user.id)
        .single()
      
      locId = userRow?.location_id

      if (locId) {
        const { data: loc } = await supabase.from('locations').select('name').eq('id', locId).single()
        if (loc?.name) setLocationName(loc.name)
      }
    } catch {
      setLocationName('Sucursal')
    }

    let query = supabase
      .from('sales')
      .select('id, total, status, created_at, user_id')
      .order('created_at', { ascending: false })

    // Filtro por location_id
    if (locId) {
      query = query.eq('location_id', locId)
    }

    const { data, error: salesError } = await query

    if (salesError) {
      setError(salesError.message)
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
      user: userMap.has(sale.user_id) ? { full_name: userMap.get(sale.user_id) } : null,
    }))

    setSales(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!error && data) setSalePaymentsMap(prev => ({ ...prev, [saleId]: data }))
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

  // --- Handlers de Acciones ---
  const handleVoid = async () => {
    if (!voidSaleId || !voidReason.trim()) return setError('El motivo es obligatorio')
    setError(null); setSuccess(null)

    const res = await fetch('/api/sales/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: voidSaleId, reason: voidReason }),
    })

    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al anular venta')
    else {
      setSuccess(`Venta anulada. Movimientos generados: ${data.data.movements_created}`)
      setVoidSaleId(null); setVoidReason('')
      await loadSales()
    }
  }

  const handleConfirmPayment = async (saleId: string) => {
    setError(null); setSuccess(null)
    const res = await fetch('/api/sales/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: saleId }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al confirmar pago')
    else {
      setSuccess('Pago confirmado correctamente')
      await loadSales()
    }
  }

  const handleCancelPending = async () => {
    if (!cancelSaleId || !cancelReason.trim()) return setError('El motivo es obligatorio')
    setError(null); setSuccess(null)

    const res = await fetch('/api/sales/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: cancelSaleId, reason: cancelReason }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al cancelar venta')
    else {
      setSuccess('Venta pendiente cancelada y stock liberado')
      setCancelSaleId(null); setCancelReason('')
      await loadSales()
    }
  }

  const handleReturn = async () => {
    if (!returnSaleId || !returnReason.trim()) return setError('El motivo es obligatorio')
    const items = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ product_id: productId, quantity }))

    if (items.length === 0) return setError('Seleccioná al menos un ítem con cantidad')

    setError(null); setSuccess(null)
    const res = await fetch('/api/sales/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: returnSaleId, items, reason: returnReason }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al procesar devolución')
    else {
      setSuccess(`Devolución procesada. Movimientos generados: ${data.data.movements_created}`)
      setReturnSaleId(null); setReturnReason(''); setReturnItems({})
      await loadSales()
    }
  }

  // --- UI Helpers ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Completada</span>
      case 'pending':
        return <span className="bg-amber-400/20 text-amber-100 border border-amber-300/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">Pendiente</span>
      case 'voided':
      case 'canceled':
        return <span className="bg-rose-500/20 text-rose-100 border border-rose-300/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Anulada</span>
      default:
        return <span className="bg-white/10 text-white/80 border border-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return '💵 Efectivo'
      case 'mercadopago': return '📱 Mercado Pago'
      case 'transfer': return '🏦 Transferencia'
      default: return method
    }
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 text-white hover:bg-white/25 transition-all shadow-lg shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <img src="/logo-mega-shop.png" alt="Logo" className="h-9 sm:h-12 w-auto object-contain drop-shadow-md select-none pointer-events-none" />
            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">Ventas</h1>
              <p className="text-white/70 text-xs sm:text-sm">Historial · {locationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pos" className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all">POS</Link>
          </div>
        </header>

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-5 space-y-2">
            {error && <div className="bg-rose-500/20 backdrop-blur-xl border border-rose-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">{error}</div>}
            {success && <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">{success}</div>}
          </div>
        )}

        {/* Lista de Ventas */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white/10 rounded-3xl border border-white/20">
            <p className="text-white font-extrabold text-lg">No hay ventas registradas</p>
          </div>
        ) : (
          <div className="space-y-3 pb-10">
            {sales.map(sale => (
              <div key={sale.id} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-lg overflow-hidden transition-all duration-300">
                
                {/* Cabecera del Ticket */}
                <div 
                  className={`p-4 sm:p-5 cursor-pointer hover:bg-white/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${expandedSaleId === sale.id ? 'bg-white/5' : ''}`}
                  onClick={() => toggleExpand(sale.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-white font-extrabold text-base sm:text-lg">Ticket {sale.id.slice(0, 6).toUpperCase()}</span>
                      {getStatusBadge(sale.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                      <span>{new Date(sale.created_at).toLocaleString('es-AR')}</span>
                      <span className="hidden sm:inline">·</span>
                      <span>Vendedor: {sale.user?.full_name || 'Desconocido'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Total</div>
                      <div className={`font-extrabold text-xl sm:text-2xl drop-shadow ${sale.status === 'voided' ? 'text-white/40 line-through' : 'text-white'}`}>
                        ${formatMoney(sale.total)}
                      </div>
                    </div>
                    <div className="text-white/40 shrink-0">
                      <svg className={`w-5 h-5 transition-transform duration-300 ${expandedSaleId === sale.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Detalle Expandido */}
                {expandedSaleId === sale.id && (
                  <div className="bg-black/20 border-t border-white/10 p-4 sm:p-5 space-y-5 animate-fade-in-down">
                    
                    {/* Botonera de Acciones Rápida */}
                    <div className="flex flex-wrap gap-2">
                      {sale.status === 'pending' && (
                        <>
                          <button onClick={() => handleConfirmPayment(sale.id)} className="px-4 py-2 bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-xs font-bold rounded-xl shadow border border-white/20 hover:brightness-110">Confirmar Pago</button>
                          <button onClick={() => setCancelSaleId(sale.id)} className="px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-xl border border-white/20 hover:bg-white/20">Cancelar</button>
                        </>
                      )}
                      <button onClick={() => setVoidSaleId(sale.id)} disabled={sale.status === 'voided' || sale.status === 'pending'} className="px-4 py-2 bg-rose-500/20 text-rose-100 border border-rose-300/30 text-xs font-bold rounded-xl hover:bg-rose-500/30 disabled:opacity-30 disabled:grayscale transition-all">
                        Anular Ticket
                      </button>
                      <button onClick={() => { setReturnSaleId(sale.id); loadSaleItems(sale.id); }} disabled={sale.status === 'voided' || sale.status === 'pending'} className="px-4 py-2 bg-amber-400/20 text-amber-100 border border-amber-300/30 text-xs font-bold rounded-xl hover:bg-amber-400/30 disabled:opacity-30 disabled:grayscale transition-all">
                        Devolver Ítems
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Ítems Vendidos */}
                      {saleItemsMap[sale.id] && (
                        <div className="space-y-2">
                          <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Detalle de productos</h3>
                          {saleItemsMap[sale.id].map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm p-2.5 bg-white/5 rounded-xl border border-white/5">
                              <div>
                                <span className="text-white font-medium">{item.product?.name || 'Producto genérico'}</span>
                                <div className="text-white/50 text-xs mt-0.5">{item.quantity} x ${formatMoney(item.unit_price)}</div>
                              </div>
                              <span className="text-white font-bold">${formatMoney(item.quantity * item.unit_price)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-5">
                        {/* Pagos */}
                        {salePaymentsMap[sale.id] && salePaymentsMap[sale.id].length > 0 && (
                          <div>
                            <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Registro de Pagos</h3>
                            {salePaymentsMap[sale.id].map((payment: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm p-2.5 bg-white/5 rounded-xl border border-white/5 mb-1.5">
                                <div>
                                  <span className="text-white font-medium">{getMethodIcon(payment.method)}</span>
                                  <div className="text-white/50 text-[10px] uppercase mt-0.5">{payment.status}</div>
                                </div>
                                <span className="text-white font-bold">${formatMoney(payment.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Movimientos / Auditoría */}
                        {saleMovementsMap[sale.id] && saleMovementsMap[sale.id].length > 0 && (
                          <div>
                            <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Auditoría (Devoluciones/Anulaciones)</h3>
                            <div className="space-y-1.5">
                              {saleMovementsMap[sale.id].map((mov: any) => (
                                <div key={mov.id} className={`text-xs p-2.5 rounded-xl border ${mov.movement_type === 'return' ? 'bg-amber-400/10 border-amber-400/20' : mov.movement_type === 'cancel' ? 'bg-orange-400/10 border-orange-400/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                  <div className="font-bold mb-0.5 text-white/90">
                                    {mov.movement_type === 'return' ? 'Devolución' : mov.movement_type === 'cancel' ? 'Cancelación' : 'Anulación'} · {mov.product?.name || 'Ticket Completo'}
                                  </div>
                                  <div className="text-white/60 mb-0.5">Cant. afectada: {mov.quantity_change}</div>
                                  <div className="text-white/80 italic">"{mov.notes}"</div>
                                  <div className="text-white/40 text-[9px] uppercase mt-1">Por {mov.user?.full_name} · {new Date(mov.created_at).toLocaleString('es-AR')}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MODALES GLASS */}
        
        {/* Modal Anular */}
        {voidSaleId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in-down">
              <h2 className="text-white text-xl font-extrabold mb-2">Anular Venta Completa</h2>
              <p className="text-white/70 text-sm mb-4">La mercadería volverá al stock. Ingresá el motivo obligatorio:</p>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full bg-black/20 text-white border border-white/20 rounded-xl px-4 py-3 mb-5 outline-none focus:border-rose-400 transition-colors"
                rows={3}
                placeholder="Ej: El cliente se arrepintió, error en cobro..."
              />
              <div className="flex gap-3">
                <button onClick={() => setVoidSaleId(null)} className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all">Cancelar</button>
                <button onClick={handleVoid} className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg transition-all">Confirmar Anulación</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Devolución */}
        {returnSaleId && saleItemsMap[returnSaleId] && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-fade-in-down">
              <h2 className="text-white text-xl font-extrabold mb-1">Devolución Parcial</h2>
              <p className="text-white/70 text-sm mb-4">Seleccioná la cantidad a devolver por ítem:</p>
              
              <div className="overflow-y-auto pr-2 space-y-2 mb-4 flex-1">
                {saleItemsMap[returnSaleId].map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.product?.name || 'Producto'}</p>
                      <p className="text-white/50 text-xs">Vendido: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/50 text-xs">Devolver:</span>
                      <input
                        type="number" min="0" max={item.quantity}
                        value={returnItems[item.product_id] || 0}
                        onChange={(e) => {
                          const qty = Math.min(parseInt(e.target.value) || 0, item.quantity)
                          setReturnItems(prev => ({ ...prev, [item.product_id]: qty }))
                        }}
                        className="w-16 bg-black/20 text-white font-bold text-center border border-white/20 rounded-lg py-1.5 outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full shrink-0 bg-black/20 text-white border border-white/20 rounded-xl px-4 py-3 mb-5 outline-none focus:border-amber-400 transition-colors"
                rows={2}
                placeholder="Motivo de devolución..."
              />
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setReturnSaleId(null)} className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all">Cancelar</button>
                <button onClick={handleReturn} className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all text-sm">Procesar Devolución</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Cancelar Pendiente */}
        {cancelSaleId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in-down">
              <h2 className="text-white text-xl font-extrabold mb-2">Cancelar Ticket Pendiente</h2>
              <p className="text-white/70 text-sm mb-4">El pago no se acreditó. Ingresá el motivo para liberar el stock:</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-black/20 text-white border border-white/20 rounded-xl px-4 py-3 mb-5 outline-none focus:border-white/40 transition-colors"
                rows={2}
                placeholder="Ej: Falló Mercadopago..."
              />
              <div className="flex gap-3">
                <button onClick={() => setCancelSaleId(null)} className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all">Cerrar</button>
                <button onClick={handleCancelPending} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl shadow-lg transition-all">Cancelar Venta</button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  )
}