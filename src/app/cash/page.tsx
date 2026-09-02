'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

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
}

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
  const supabase = createClient()

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

  useEffect(() => {
    loadData()
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
      setSuccess(`Caja cerrada. Diferencia: $${data.data?.difference?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
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

  const totalCashSales = movements
    .filter(m => m.movement_type === 'sale_cash')
    .reduce((acc, m) => acc + m.amount, 0)

  const totalOther = movements
    .filter(m => m.movement_type !== 'sale_cash')
    .reduce((acc, m) => acc + m.amount, 0)

  const expectedCash = session ? (session.initial_cash + totalCashSales + totalOther) : 0

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Caja</h1>

          {error && <div className="text-red-400 mb-4">{error}</div>}
          {success && <div className="text-green-400 mb-4">{success}</div>}

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : !session ? (
            <div className="bg-gray-800 rounded p-6 max-w-md">
              <h2 className="text-xl font-semibold text-white mb-4">Abrir caja</h2>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Monto inicial"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded mb-4"
              />
              <button
                onClick={handleOpen}
                className="w-full py-3 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Abrir caja
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded p-6">
                <p className="text-gray-300">Caja abierta desde: {new Date(session.opened_at).toLocaleString('es-AR')}</p>
                <p className="text-gray-300">Inicial: ${session.initial_cash.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                <p className="text-gray-300">Ventas en efectivo: ${totalCashSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                <p className="text-gray-300">Otros movimientos: ${totalOther.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                <p className="text-white font-bold mt-2">Efectivo esperado: ${expectedCash.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="bg-gray-800 rounded p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Registrar movimiento</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  >
                    <option value="expense">Gasto</option>
                    <option value="withdrawal">Retiro</option>
                    <option value="deposit">Depósito</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Monto"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Nota"
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                </div>
                <button
                  onClick={handleAddMovement}
                  className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Registrar
                </button>
              </div>

              <div className="bg-gray-800 rounded p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Movimientos</h2>
                {movements.length === 0 ? (
                  <p className="text-gray-400">Sin movimientos aún.</p>
                ) : (
                  <div className="space-y-2">
                    {movements.map(m => (
                      <div key={m.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          {m.movement_type} {m.notes ? `- ${m.notes}` : ''}
                        </span>
                        <span className={m.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${m.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Cerrar caja</h2>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Monto final contado"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded mb-4"
                />
                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cerrar caja
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}