'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type CashSession = {
  id: string
  initial_cash: number
  final_cash: number | null
  status: string
  opened_at: string
}

type CashMovement = {
  id: string
  movement_type: string
  amount: number
  notes: string | null
  created_at: string
  user_full_name?: string | null
}

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CashPage() {
  const [session, setSession] = useState<CashSession | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [initialCash, setInitialCash] = useState('')
  const [finalCash, setFinalCash] = useState('')
  
  const [movementType, setMovementType] = useState<'expense' | 'withdrawal' | 'deposit'>('expense')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNotes, setMovementNotes] = useState('')
  
  const [locationName, setLocationName] = useState('Cargando...')
  const supabase = useMemo(() => createClient(), [])

  const loadData = async () => {
    setLoading(true)
    const res = await fetch('/api/cash/movements')
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error cargando caja')
    } else {
      setSession(data.session)
      setMovements(data.movements || [])
    }
    setLoading(false)
  }

  // Agregamos un helper visual para obtener el nombre del local para el header
  const loadLocationName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userRow } = await supabase.from('users').select('location_id').eq('id', user.id).single()
      if (userRow?.location_id) {
        const { data: loc } = await supabase.from('locations').select('name').eq('id', userRow.location_id).single()
        if (loc?.name) setLocationName(loc.name)
      }
    } catch {
      setLocationName('Sucursal')
    }
  }

  useEffect(() => {
    loadLocationName()
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpen = async () => {
    const num = parseFloat(initialCash)
    if (isNaN(num) || num < 0) {
      setError('Ingresá un monto inicial válido')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_cash: num }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al abrir caja')
    } else {
      setSuccess('Caja abierta correctamente')
      setInitialCash('')
      await loadData()
    }
  }

  const handleClose = async () => {
    if (!session) return
    const num = parseFloat(finalCash)
    if (isNaN(num) || num < 0) {
      setError('Ingresá un monto final válido')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/cash/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, final_cash: num }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al cerrar caja')
    } else {
      setSuccess(`Caja cerrada. Diferencia: $${formatMoney(data.data?.difference || 0)}`)
      setFinalCash('')
      await loadData()
    }
  }

  const handleAddMovement = async () => {
    if (!session) return
    const amount = parseFloat(movementAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Ingresá un monto válido')
      return
    }

    setError(null)
    setSuccess(null)

    const res = await fetch('/api/cash/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        amount,
        movement_type: movementType,
        notes: movementNotes,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al registrar movimiento')
    } else {
      setSuccess('Movimiento registrado')
      setMovementAmount('')
      setMovementNotes('')
      await loadData()
    }
  }

  // Cálculos
  const totalCashSales = movements
    .filter(m => m.movement_type === 'sale_cash')
    .reduce((acc, m) => acc + m.amount, 0)

  const totalOther = movements
    .filter(m => m.movement_type !== 'sale_cash')
    .reduce((acc, m) => acc + m.amount, 0)

  const expectedCash = session ? (session.initial_cash + totalCashSales + totalOther) : 0

  // Helpers visuales
  const movementConfig = {
    sale_cash: { label: 'Venta', icon: '💰', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    expense: { label: 'Gasto', icon: '📉', color: 'text-rose-400', bg: 'bg-rose-500/10' },
    withdrawal: { label: 'Retiro', icon: '🏧', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    deposit: { label: 'Depósito', icon: '📈', color: 'text-blue-400', bg: 'bg-blue-500/10' },
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
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <img src="/logo-mega-shop.png" alt="Logo" className="h-9 sm:h-12 w-auto object-contain drop-shadow-md select-none pointer-events-none" />
            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">Caja</h1>
              <p className="text-white/70 text-xs sm:text-sm">Control de turno · {locationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pos" className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all">POS</Link>
          </div>
        </header>

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-6 space-y-2 animate-fade-in-down">
            {error && <div className="bg-rose-500/20 backdrop-blur-xl border border-rose-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">{error}</div>}
            {success && <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">{success}</div>}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
            <span className="text-white/80 text-sm font-medium">Sincronizando caja...</span>
          </div>
        ) : !session ? (
          
          /* PANTALLA: CAJA CERRADA */
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center animate-fade-in-up">
              <div className="w-20 h-20 mx-auto bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <span className="text-4xl">🔐</span>
              </div>
              <h2 className="text-white text-2xl font-extrabold mb-2 drop-shadow">Caja Cerrada</h2>
              <p className="text-white/70 text-sm mb-6">Ingresá el dinero inicial o cambio para abrir el turno en {locationName}.</p>
              
              <div className="relative mb-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold text-xl">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  className="w-full pl-9 pr-4 py-4 bg-black/20 backdrop-blur-xl text-white text-xl font-bold border border-white/20 rounded-2xl focus:bg-black/30 focus:border-emerald-400 outline-none transition-all placeholder:text-white/30 text-center"
                />
              </div>
              
              <button
                onClick={handleOpen}
                className="w-full py-4 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-lg font-extrabold shadow-xl border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Abrir Turno
              </button>
            </div>
          </div>

        ) : (

          /* PANTALLA: CAJA ABIERTA */
          <div className="flex flex-col gap-6 animate-fade-in-up pb-10">
            
            {/* 1. KPIs SUPERIORES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-6 -top-6 text-white/5 text-9xl pointer-events-none">💰</div>
                <p className="text-white/70 text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">Efectivo Esperado en Caja</p>
                <p className="text-white text-4xl sm:text-5xl font-extrabold drop-shadow-lg tracking-tight">
                  ${formatMoney(expectedCash)}
                </p>
                <p className="text-white/50 text-xs mt-2 font-medium">
                  Abierta: {new Date(session.opened_at).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                </p>
              </div>

              <div className="grid grid-rows-2 gap-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-lg flex flex-col justify-center">
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Fondo Inicial</p>
                  <p className="text-white text-xl font-bold">${formatMoney(session.initial_cash)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-lg flex flex-col justify-center">
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Ventas Efectivo</p>
                  <p className="text-emerald-300 text-xl font-bold">+ ${formatMoney(totalCashSales)}</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-5 shadow-lg flex flex-col justify-center">
                <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Otros Movimientos</p>
                <div className="text-2xl font-extrabold drop-shadow">
                  <span className={totalOther >= 0 ? 'text-blue-300' : 'text-rose-300'}>
                    {totalOther >= 0 ? '+' : ''}${formatMoney(totalOther)}
                  </span>
                </div>
                <p className="text-white/40 text-[10px] uppercase mt-2 leading-tight">Incluye gastos, retiros y depósitos extra.</p>
              </div>
            </div>

            {/* 2. OPERACIONES Y MOVIMIENTOS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda: Acciones */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Nuevo Movimiento */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-xl">
                  <h2 className="text-white text-lg font-extrabold mb-4 drop-shadow">Registrar Movimiento</h2>
                  
                  {/* Selector tipo "Pills" */}
                  <div className="flex bg-black/20 rounded-xl p-1 mb-4 border border-white/10">
                    <button onClick={() => setMovementType('expense')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${movementType === 'expense' ? 'bg-white text-rose-600 shadow' : 'text-white/70 hover:text-white'}`}>Gasto</button>
                    <button onClick={() => setMovementType('withdrawal')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${movementType === 'withdrawal' ? 'bg-white text-orange-600 shadow' : 'text-white/70 hover:text-white'}`}>Retiro</button>
                    <button onClick={() => setMovementType('deposit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${movementType === 'deposit' ? 'bg-white text-blue-600 shadow' : 'text-white/70 hover:text-white'}`}>Depósito</button>
                  </div>

                  <div className="space-y-4 mb-5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
                      <input
                        type="number" step="0.01" min="0" placeholder="Monto"
                        value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-3 bg-white/5 border border-white/15 text-white rounded-xl outline-none focus:bg-white/10 focus:border-white/30 transition-all placeholder:text-white/30"
                      />
                    </div>
                    <input
                      type="text" placeholder="Nota o detalle (opcional)"
                      value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 text-white rounded-xl outline-none focus:bg-white/10 focus:border-white/30 transition-all placeholder:text-white/30"
                    />
                  </div>

                  <button
                    onClick={handleAddMovement}
                    className="w-full py-3.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-extrabold shadow-md border border-white/20 active:scale-[0.98] transition-all"
                  >
                    Registrar en Caja
                  </button>
                </div>

                {/* Cierre de Caja */}
                <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-xl mt-auto">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🛑</span>
                    <h2 className="text-white text-lg font-extrabold drop-shadow">Cerrar Turno</h2>
                  </div>
                  <p className="text-rose-200/70 text-xs mb-4">Contá los billetes en la caja e ingresá el total real para hacer el arqueo.</p>
                  
                  <div className="relative mb-4">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="Total real contado"
                      value={finalCash} onChange={(e) => setFinalCash(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 bg-black/30 border border-rose-500/30 text-white font-bold rounded-xl outline-none focus:bg-black/50 focus:border-rose-400 transition-all placeholder:text-white/30"
                    />
                  </div>
                  
                  <button
                    onClick={handleClose}
                    className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg border border-rose-400/50 active:scale-[0.98] transition-all"
                  >
                    Confirmar Cierre
                  </button>
                </div>

              </div>

              {/* Columna Derecha: Historial */}
              <div className="lg:col-span-7 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl flex flex-col min-h-[400px]">
                <div className="p-5 border-b border-white/15">
                  <h2 className="text-white text-lg font-extrabold drop-shadow">Historial del Turno</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {movements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <span className="text-4xl opacity-50 mb-3">📭</span>
                      <p className="text-white/60 text-sm">Aún no hay movimientos en este turno.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 px-2 pb-2">
                      {movements.map(m => {
                        const conf = movementConfig[m.movement_type as keyof typeof movementConfig] || { label: m.movement_type, icon: '📄', color: 'text-gray-300', bg: 'bg-white/10' }
                        return (
                          <div key={m.id} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${conf.bg}`}>
                              {conf.icon}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-white font-bold text-sm truncate">{conf.label}</span>
                                <span className={`font-extrabold text-sm sm:text-base shrink-0 ${conf.color}`}>
                                  {m.amount >= 0 ? '+' : ''}${formatMoney(m.amount)}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                                <span className="text-white/50 truncate max-w-[180px]">{m.notes || 'Sin detalle'}</span>
                                <span className="text-white/40">{new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {m.user_full_name?.split(' ')[0] || 'User'}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}