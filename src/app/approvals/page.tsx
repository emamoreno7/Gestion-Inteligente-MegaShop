'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ApprovalsPage() {
  const [imports, setImports] = useState<BulkImport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    id: string
    action: 'approve' | 'reject'
  } | null>(null)
  const [processing, setProcessing] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadPending = async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('bulk_imports')
      .select(
        `
        *,
        user:users!bulk_imports_created_by_fkey(full_name)
      `
      )
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
    } else {
      const mapped = (data || []).map((item: any) => ({
        ...item,
        user_full_name: item.user?.full_name || 'Desconocido',
      }))
      setImports(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleApprove = async (id: string) => {
    setError(null)
    setSuccess(null)
    setProcessing(true)

    const res = await fetch('/api/import/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkImportId: id }),
    })

    const data = await res.json()
    setProcessing(false)

    if (!res.ok) {
      setError(data.error || 'Error al aprobar')
    } else {
      setSuccess('Carga aprobada correctamente. Stock actualizado.')
      setConfirmAction(null)
      await loadPending()
    }
  }

  const handleReject = async (id: string) => {
    setError(null)
    setSuccess(null)
    setProcessing(true)

    const res = await fetch('/api/import/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkImportId: id }),
    })

    const data = await res.json()
    setProcessing(false)

    if (!res.ok) {
      setError(data.error || 'Error al rechazar')
    } else {
      setSuccess('Carga rechazada')
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
    return products.reduce(
      (acc, p) => acc + (p.cost_price || 0) * (p.quantity || 1),
      0
    )
  }

  const importTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      csv: 'CSV',
      excel: 'Excel',
      ocr: 'Foto / OCR',
    }
    return map[type] || type.toUpperCase()
  }

  const importTypeBadge = (type: string) => {
    if (type === 'ocr') {
      return 'bg-violet-400/20 text-violet-100 border-violet-300/30'
    }
    if (type === 'excel') {
      return 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30'
    }
    return 'bg-sky-400/20 text-sky-100 border-sky-300/30'
  }

  const activeImport = confirmAction
    ? imports.find((i) => i.id === confirmAction.id)
    : null

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      {/* Fondo */}
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
                Aprobaciones
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">
                {loading
                  ? 'Cargando...'
                  : imports.length === 0
                  ? 'Sin pendientes'
                  : `${imports.length} carga${imports.length === 1 ? '' : 's'} por revisar`}
              </p>
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

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-5 space-y-2">
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

        {/* KPI */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">
                Cargas
              </div>
              <div className="text-teal-200 text-2xl font-extrabold">{imports.length}</div>
            </div>
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">
                Unidades
              </div>
              <div className="text-white text-2xl font-extrabold">
                {imports.reduce((acc, imp) => acc + getProductCount(imp), 0)}
              </div>
            </div>
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg col-span-2 sm:col-span-1">
              <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">
                Costo total
              </div>
              <div className="text-white text-xl sm:text-2xl font-extrabold tracking-tight">
                $
                {formatCurrency(
                  imports.reduce((acc, imp) => acc + getTotalCost(imp), 0)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contenido */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white/80 text-sm font-medium">Cargando aprobaciones...</span>
            </div>
          </div>
        ) : imports.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-400/20 border border-emerald-300/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-white font-extrabold text-lg">No hay cargas pendientes</p>
            <p className="text-white/60 text-sm mt-1">
              Todo lo importado ya fue revisado o no requiere aprobación.
            </p>
            <Link
              href="/import"
              className="mt-5 px-5 py-2.5 rounded-2xl bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-all"
            >
              Ir a Importar
            </Link>
          </div>
        ) : (
          <div className="space-y-3 pb-10">
            {imports.map((imp) => {
              const isExpanded = expandedId === imp.id
              const units = getProductCount(imp)
              const cost = getTotalCost(imp)

              return (
                <div
                  key={imp.id}
                  className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-lg overflow-hidden transition-all"
                >
                  {/* Cabecera de la carga */}
                  <div
                    className={`p-4 sm:p-5 cursor-pointer hover:bg-white/5 transition-colors ${
                      isExpanded ? 'bg-white/5' : ''
                    }`}
                    onClick={() => toggleExpand(imp.id)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h2 className="text-white font-extrabold text-base sm:text-lg truncate max-w-full">
                            {imp.filename || 'Sin nombre de archivo'}
                          </h2>
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${importTypeBadge(
                              imp.import_type
                            )}`}
                          >
                            {importTypeLabel(imp.import_type)}
                          </span>
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-400/20 text-amber-100 border-amber-300/30 animate-pulse">
                            Pendiente
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                          <span>
                            {imp.total_rows} producto{imp.total_rows === 1 ? '' : 's'} · {units} unidad
                            {units === 1 ? '' : 'es'}
                          </span>
                          <span className="hidden sm:inline">·</span>
                          <span>Costo est.: ${formatCurrency(cost)}</span>
                          <span className="hidden sm:inline">·</span>
                          <span>
                            Por {imp.user_full_name} ·{' '}
                            {new Date(imp.created_at).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setConfirmAction({ id: imp.id, action: 'approve' })
                          }
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white text-xs font-extrabold shadow-md border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({ id: imp.id, action: 'reject' })
                          }
                          className="px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-100 border border-rose-300/30 text-xs font-extrabold hover:bg-rose-500/30 active:scale-[0.98] transition-all"
                        >
                          Rechazar
                        </button>
                        <div className="text-white/40 pl-1">
                          <svg
                            className={`w-5 h-5 transition-transform duration-300 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="border-t border-white/10 bg-black/20 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                          Productos incluidos
                        </h3>
                        <div className="text-xs text-white/70 font-semibold">
                          {units} un. · ${formatCurrency(cost)}
                        </div>
                      </div>

                      {imp.metadata?.products && imp.metadata.products.length > 0 ? (
                        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                          <table className="min-w-full">
                            <thead className="bg-white/5 border-b border-white/10">
                              <tr>
                                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/55">
                                  Producto
                                </th>
                                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/55">
                                  Cant.
                                </th>
                                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/55">
                                  Rubro
                                </th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/55">
                                  Costo unit.
                                </th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/55">
                                  Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {imp.metadata.products.map((p, idx) => {
                                const qty = p.quantity || 1
                                const unit = p.cost_price ?? null
                                const subtotal =
                                  unit !== null && unit !== undefined ? unit * qty : null
                                return (
                                  <tr
                                    key={idx}
                                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                  >
                                    <td className="px-3 py-2.5">
                                      <div className="text-white text-sm font-semibold">
                                        {p.name || '-'}
                                      </div>
                                      {(p.sku || p.barcode) && (
                                        <div className="text-white/40 text-[11px] mt-0.5">
                                          {p.sku || p.barcode}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <span className="inline-flex min-w-[28px] justify-center px-2 py-0.5 rounded-full bg-white/10 text-white text-xs font-bold">
                                        {qty}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/10 text-white/75">
                                        {p.category || 'otros'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm text-white/80">
                                      {unit !== null && unit !== undefined
                                        ? `$${formatCurrency(unit)}`
                                        : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm text-white font-bold">
                                      {subtotal !== null
                                        ? `$${formatCurrency(subtotal)}`
                                        : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="bg-white/5 border-t border-white/10">
                              <tr>
                                <td
                                  colSpan={2}
                                  className="px-3 py-2.5 text-xs font-extrabold text-white"
                                >
                                  Total unidades: {units}
                                </td>
                                <td
                                  colSpan={3}
                                  className="px-3 py-2.5 text-xs font-extrabold text-white text-right"
                                >
                                  Total costo: ${formatCurrency(cost)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-white/55 py-4 text-center">
                          No hay productos cargados en esta importación.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal de confirmación */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 shadow-2xl">
              <div
                className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center border shadow-lg ${
                  confirmAction.action === 'approve'
                    ? 'bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] border-white/25'
                    : 'bg-rose-500/30 border-rose-300/30'
                }`}
              >
                {confirmAction.action === 'approve' ? (
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>

              <h2 className="text-white text-xl font-extrabold text-center mb-2 drop-shadow">
                {confirmAction.action === 'approve'
                  ? 'Confirmar aprobación'
                  : 'Confirmar rechazo'}
              </h2>

              <p className="text-white/70 text-sm text-center mb-2">
                {confirmAction.action === 'approve'
                  ? 'Se va a ingresar la mercadería al stock de la sucursal.'
                  : 'La carga quedará rechazada y no impactará el stock.'}
              </p>

              {activeImport && (
                <div className="bg-white/10 border border-white/15 rounded-2xl p-3 mb-5 text-center">
                  <div className="text-white font-semibold text-sm truncate">
                    {activeImport.filename}
                  </div>
                  <div className="text-white/55 text-xs mt-1">
                    {getProductCount(activeImport)} un. · $
                    {formatCurrency(getTotalCost(activeImport))} · por{' '}
                    {activeImport.user_full_name}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={processing}
                  className="flex-1 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.action === 'approve') {
                      handleApprove(confirmAction.id)
                    } else {
                      handleReject(confirmAction.id)
                    }
                  }}
                  disabled={processing}
                  className={`flex-1 px-4 py-3 rounded-2xl text-white font-extrabold shadow-lg border border-white/20 transition-all disabled:opacity-50 ${
                    confirmAction.action === 'approve'
                      ? 'bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] hover:brightness-110'
                      : 'bg-rose-500 hover:bg-rose-600'
                  }`}
                >
                  {processing
                    ? 'Procesando...'
                    : confirmAction.action === 'approve'
                    ? 'Sí, aprobar'
                    : 'Sí, rechazar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}