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

type ProductActionModal = {
  productId: string
  locationId: string
  productName: string
  currentStock: number
  movements: Array<{
    id: string
    quantity_change: number
    movement_type: string
    notes: string | null
    created_at: string
  }>
} | null

export default function StockPage() {
  const [tab, setTab] = useState<'current' | 'movements'>('current')
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locationName, setLocationName] = useState<string>('Sucursal')
  const [actionModal, setActionModal] = useState<ProductActionModal>(null)
  const [actionMode, setActionMode] = useState<'menu' | 'zero' | 'deactivate'>('menu')
  const [actionReason, setActionReason] = useState('')
  const [actionProcessing, setActionProcessing] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
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

        const [userRowResult, roleRowResult] = await Promise.all([
          supabase
            .from('users')
            .select('location_id')
            .eq('id', user.id)
            .single(),
          supabase
            .from('users')
            .select('role:roles (name)')
            .eq('id', user.id)
            .single(),
        ])

        if (!userRowResult.error && userRowResult.data) {
          locationId = userRowResult.data.location_id ?? null
        }

        const roleData: any = roleRowResult.data?.role
        const roleName = Array.isArray(roleData) ? roleData[0]?.name : roleData?.name
        if (roleName) setUserRole(roleName)

        if (locationId) {
          const { data: loc } = await supabase
            .from('locations')
            .select('name')
            .eq('id', locationId)
            .single()
          if (loc?.name) setLocationName(loc.name)
        }

        if (tab === 'current') {
         let query = supabase
           .from('stock_levels')
           .select(`
             location_id,
             product_id,
             quantity,
             product:products!inner (
               name,
               sku,
               barcode,
               is_active,
               category:categories (name)
             )
           `)
           .eq('product.is_active', true)
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

  const openProductActions = async (
    productId: string,
    locationId: string,
    productName: string,
    currentStock: number
  ) => {
    setActionProcessing(true)
    setActionMode('menu')
    setActionReason('')

    const { data } = await supabase
      .from('stock_movements')
      .select('id, quantity_change, movement_type, notes, created_at')
      .eq('product_id', productId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20)

    setActionModal({
      productId,
      locationId,
      productName,
      currentStock,
      movements: (data as any[]) || [],
    })
    setActionProcessing(false)
  }

  const closeProductActions = () => {
    setActionModal(null)
    setActionMode('menu')
    setActionReason('')
    setActionProcessing(false)
  }

  const handleZeroStock = async () => {
    if (!actionModal) return
    if (actionReason.trim().length < 3) return

    setActionProcessing(true)
    try {
      const res = await fetch('/api/products/set-stock-zero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: actionModal.productId,
          location_id: actionModal.locationId,
          reason: actionReason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al poner stock en 0')
        setActionProcessing(false)
        return
      }
      // Actualizar el stock localmente y recargar
      setStockLevels(prev =>
        prev.map(item =>
          item.product_id === actionModal.productId &&
          item.location_id === actionModal.locationId
            ? { ...item, quantity: 0 }
            : item
        )
      )
      closeProductActions()
      window.location.reload()
    } catch (e) {
      alert('Error de red')
      setActionProcessing(false)
    }
  }

  const handleDeactivateProduct = async () => {
    if (!actionModal) return
    if (actionReason.trim().length < 3) return

    setActionProcessing(true)
    try {
      const res = await fetch('/api/products/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: actionModal.productId,
          reason: actionReason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al desactivar producto')
        setActionProcessing(false)
        return
      }
      // Removerlo de la vista
      setStockLevels(prev =>
        prev.filter(item => item.product_id !== actionModal.productId)
      )
      closeProductActions()
      window.location.reload()
    } catch (e) {
      alert('Error de red')
      setActionProcessing(false)
    }
  }

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
              href="/cash"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Caja
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
                         onClick={() => openProductActions(
                           item.product_id,
                           item.location_id,
                           item.product?.name || 'Producto',
                           item.quantity
                         )}
                         className="border-b border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
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

       {actionModal && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="w-full max-w-2xl bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
             {actionMode === 'menu' && (
               <>
                 <div className="flex items-start justify-between mb-4">
                   <div className="flex-1">
                     <h3 className="text-white text-lg font-extrabold break-words">
                       {actionModal.productName}
                     </h3>
                     <p className="text-white/60 text-sm mt-1">
                       Stock actual: <span className="text-white font-bold">{actionModal.currentStock}</span>
                     </p>
                   </div>
                   <button
                     onClick={closeProductActions}
                     className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white shrink-0"
                   >
                     ✕
                   </button>
                 </div>

                 <div className="mb-5">
                   <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                     Últimos movimientos
                   </p>
                   <div className="bg-black/20 rounded-2xl border border-white/10 max-h-60 overflow-y-auto">
                     {actionModal.movements.length === 0 ? (
                       <p className="text-white/50 text-sm p-4 text-center">Sin movimientos</p>
                     ) : (
                       <table className="w-full text-sm">
                         <tbody>
                           {actionModal.movements.map((mov) => (
                             <tr key={mov.id} className="border-b border-white/5 last:border-0">
                               <td className="px-4 py-2 text-white/70 text-xs whitespace-nowrap">
                                 {new Date(mov.created_at).toLocaleDateString('es-AR', {
                                   day: '2-digit',
                                   month: '2-digit',
                                   year: '2-digit',
                                   hour: '2-digit',
                                   minute: '2-digit',
                                 })}
                               </td>
                               <td className="px-2 py-2">
                                 <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 border border-white/15 text-white/80">
                                   {mov.movement_type}
                                 </span>
                               </td>
                               <td className={`px-2 py-2 font-bold text-xs text-right ${mov.quantity_change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                 {mov.quantity_change >= 0 ? '+' : ''}{mov.quantity_change}
                               </td>
                               <td className="px-4 py-2 text-white/60 text-xs truncate max-w-[200px]">
                                 {mov.notes || '-'}
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     )}
                   </div>
                 </div>

                 {userRole === 'owner_admin' ? (
                   <div className="space-y-2">
                     <button
                       onClick={() => setActionMode('zero')}
                       disabled={actionModal.currentStock === 0}
                       className="w-full text-left px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <p className="font-bold text-sm">Poner stock en 0</p>
                       <p className="text-white/60 text-xs mt-0.5">
                         {actionModal.currentStock === 0
                           ? 'Ya está en 0'
                           : `Se registrará un ajuste de -${actionModal.currentStock}`}
                       </p>
                     </button>
                     <button
                       onClick={() => setActionMode('deactivate')}
                       className="w-full text-left px-4 py-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-100 hover:bg-rose-500/30"
                     >
                       <p className="font-bold text-sm">Eliminar producto</p>
                       <p className="text-rose-100/70 text-xs mt-0.5">
                         El producto se desactiva y desaparece del catálogo y del stock. Reversible.
                       </p>
                     </button>
                   </div>
                 ) : (
                   <p className="text-white/50 text-xs text-center py-3">
                     Solo owner/admin puede modificar stock o eliminar productos
                   </p>
                 )}
               </>
             )}

             {actionMode === 'zero' && (
               <>
                 <h3 className="text-white text-lg font-extrabold mb-2">
                   Poner stock en 0
                 </h3>
                 <p className="text-white/70 text-sm mb-4">
                   <span className="font-bold text-white">{actionModal.productName}</span>
                   <br />
                   Stock actual: {actionModal.currentStock} → 0
                 </p>
                 <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                   Motivo (obligatorio)
                 </label>
                 <textarea
                   value={actionReason}
                   onChange={(e) => setActionReason(e.target.value)}
                   rows={3}
                   maxLength={300}
                   placeholder="Ej: producto descontinuado, faltante de inventario, etc."
                   className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 text-sm resize-none"
                 />
                 <p className="text-white/50 text-xs mt-1 mb-4">
                   {actionReason.trim().length}/300 · mínimo 3 caracteres
                 </p>
                 <div className="flex gap-2 justify-end">
                   <button
                     onClick={() => { setActionMode('menu'); setActionReason('') }}
                     disabled={actionProcessing}
                     className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50"
                   >
                     Volver
                   </button>
                   <button
                     onClick={handleZeroStock}
                     disabled={actionProcessing || actionReason.trim().length < 3}
                     className="px-4 py-2 rounded-xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white font-bold text-sm hover:brightness-110 disabled:opacity-50"
                   >
                     {actionProcessing ? 'Procesando...' : 'Confirmar'}
                   </button>
                 </div>
               </>
             )}

             {actionMode === 'deactivate' && (
               <>
                 <h3 className="text-white text-lg font-extrabold mb-2 text-rose-100">
                   Eliminar producto
                 </h3>
                 <p className="text-white/70 text-sm mb-4">
                   Vas a desactivar <span className="font-bold text-white">{actionModal.productName}</span>.
                   El producto dejará de aparecer en catálogo y stock, pero se puede reactivar.
                   {actionModal.currentStock > 0 && (
                     <>
                       <br />
                       <span className="text-amber-200 text-xs">
                         Atención: el producto aún tiene {actionModal.currentStock} unidades en stock.
                       </span>
                     </>
                   )}
                 </p>
                 <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                   Motivo (obligatorio)
                 </label>
                 <textarea
                   value={actionReason}
                   onChange={(e) => setActionReason(e.target.value)}
                   rows={3}
                   maxLength={300}
                   placeholder="Ej: duplicado del producto X, error de carga, etc."
                   className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 text-sm resize-none"
                 />
                 <p className="text-white/50 text-xs mt-1 mb-4">
                   {actionReason.trim().length}/300 · mínimo 3 caracteres
                 </p>
                 <div className="flex gap-2 justify-end">
                   <button
                     onClick={() => { setActionMode('menu'); setActionReason('') }}
                     disabled={actionProcessing}
                     className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50"
                   >
                     Volver
                   </button>
                   <button
                     onClick={handleDeactivateProduct}
                     disabled={actionProcessing || actionReason.trim().length < 3}
                     className="px-4 py-2 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white font-bold text-sm hover:brightness-110 disabled:opacity-50"
                   >
                     {actionProcessing ? 'Procesando...' : 'Eliminar producto'}
                   </button>
                 </div>
               </>
             )}
           </div>
         </div>
       )}
     </div>
   )
 }
