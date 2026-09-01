'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

type BulkImport = {
  id: string
  filename: string
  total_rows: number
  created_at: string
  status: string
  import_type: string
  created_by: string
  metadata: {
    products?: Array<{
      name?: string
      sku?: string | null
      barcode?: string | null
      quantity?: number
      cost_price?: number
      sale_price?: number
      category?: string
    }>
  } | null
  user_full_name?: string
}

export default function ApprovalsPage() {
  const [imports, setImports] = useState<BulkImport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const supabase = createClient()

  const loadPending = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('bulk_imports')
      .select(`
        *,
        user:users!bulk_imports_created_by_fkey(full_name)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      const mapped = data.map((item: any) => ({
        ...item,
        user_full_name: item.user?.full_name || 'Desconocido',
      }))
      setImports(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPending()
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const handleApprove = async (id: string) => {
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/import/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkImportId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al aprobar')
    } else {
      setSuccess(`Carga aprobada correctamente`)
      setConfirmAction(null)
      await loadPending()
    }
  }

  const handleReject = async (id: string) => {
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/import/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkImportId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al rechazar')
    } else {
      setSuccess(`Carga rechazada`)
      setConfirmAction(null)
      await loadPending()
    }
  }

  const getProductCount = (imp: BulkImport) => {
    const products = imp.metadata?.products || []
    return products.reduce((acc, p) => acc + (p.quantity || 1), 0)
  }

  const getTotalCost = (imp: BulkImport) => {
    const products = imp.metadata?.products || []
    return products.reduce((acc, p) => acc + ((p.cost_price || 0) * (p.quantity || 1)), 0)
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Aprobación de cargas pendientes</h1>

          {error && <div className="text-red-400 mb-4">{error}</div>}
          {success && <div className="text-green-400 mb-4">{success}</div>}

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : imports.length === 0 ? (
            <div className="bg-gray-800 rounded p-6 text-center text-gray-400">
              No hay cargas pendientes.
            </div>
          ) : (
            <div className="space-y-4">
              {imports.map(imp => (
                <div key={imp.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  <div className="p-4 cursor-pointer" onClick={() => toggleExpand(imp.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">{imp.filename}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {imp.import_type.toUpperCase()} · {imp.total_rows} productos · {getProductCount(imp)} unidades
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Cargado por: {imp.user_full_name} · {new Date(imp.created_at).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ id: imp.id, action: 'approve' })
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ id: imp.id, action: 'reject' })
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                    {expandedId === imp.id && (
                      <div className="mt-4 border-t border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Productos incluidos</h3>
                        {imp.metadata?.products && imp.metadata.products.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700">
                              <thead className="bg-gray-750">
                                <tr>
                                  <th className="px-2 py-1 text-left text-xs text-gray-400">Producto</th>
                                  <th className="px-2 py-1 text-left text-xs text-gray-400">Cant.</th>
                                  <th className="px-2 py-1 text-left text-xs text-gray-400">Rubro</th>
                                  <th className="px-2 py-1 text-left text-xs text-gray-400">Costo unit.</th>
                                  <th className="px-2 py-1 text-left text-xs text-gray-400">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700">
                                {imp.metadata.products.map((p, idx) => (
                                  <tr key={idx}>
                                    <td className="px-2 py-1 text-sm text-white">{p.name || '-'}</td>
                                    <td className="px-2 py-1 text-sm text-gray-300">{p.quantity || 1}</td>
                                    <td className="px-2 py-1 text-sm text-gray-300">{p.category || 'otros'}</td>
                                    <td className="px-2 py-1 text-sm text-gray-300">
                                      {p.cost_price !== undefined && p.cost_price !== null
                                        ? `$${formatCurrency(p.cost_price)}`
                                        : '-'}
                                    </td>
                                    <td className="px-2 py-1 text-sm text-gray-300">
                                      {p.cost_price !== undefined && p.cost_price !== null
                                        ? `$${formatCurrency(p.cost_price * (p.quantity || 1))}`
                                        : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={2} className="px-2 py-1 text-xs font-semibold text-white">
                                    Total unidades: {getProductCount(imp)}
                                  </td>
                                  <td colSpan={3} className="px-2 py-1 text-xs font-semibold text-white">
                                    Total costo: ${formatCurrency(getTotalCost(imp))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No hay productos cargados en esta importación.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold text-white mb-4">
                {confirmAction.action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </h2>
              <p className="text-gray-300 mb-6">
                ¿Estás seguro de {confirmAction.action === 'approve' ? 'aprobar' : 'rechazar'} esta carga?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (confirmAction.action === 'approve') {
                      handleApprove(confirmAction.id)
                    } else {
                      handleReject(confirmAction.id)
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Sí, confirmar
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
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