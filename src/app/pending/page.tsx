'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PendingProduct = {
  id: string
  product_id?: string
  name: string
  sku: string | null
  barcode: string | null
  cost_price: number | null
  sale_price: number | null
  price_status: string
  category_id: string | null
  category: { name: string } | null
}

type Category = {
  id: string
  name: string
}

type DuplicatePair = {
  product_a_id: string
  product_a_name: string
  product_a_sku: string | null
  product_a_barcode: string | null
  product_a_category: string | null
  product_a_stock: number
  product_b_id: string
  product_b_name: string
  product_b_sku: string | null
  product_b_barcode: string | null
  product_b_category: string | null
  product_b_stock: number
  similarity: number
}

export default function PendingPage() {
  const [withoutCategory, setWithoutCategory] = useState<PendingProduct[]>([])
  const [withoutCost, setWithoutCost] = useState<PendingProduct[]>([])
  const [pendingRecalcCount, setPendingRecalcCount] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<'rubro' | 'costo' | 'duplicados' | null>('rubro')
  const [editingCategory, setEditingCategory] = useState<Record<string, string>>({})
  const [editingCost, setEditingCost] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savingCostId, setSavingCostId] = useState<string | null>(null)
const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePair[]>([])
const [duplicateThreshold, setDuplicateThreshold] = useState(0.55)
const [confirmMerge, setConfirmMerge] = useState<{
  productAId: string
  productAName: string
  productAStock: number
  productBId: string
  productBName: string
  productBStock: number
} | null>(null)
const [processing, setProcessing] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const loadData = async (preserveSection = false) => {
    setLoading(true)
    const [pendingRes, categoriesRes, duplicatesRes] = await Promise.all([
      fetch('/api/pending'),
      supabase.from('categories').select('id, name'),
      fetch('/api/products/duplicates'),
    ])

    if (!pendingRes.ok) {
      const data = await pendingRes.json()
      setError(data.error || 'Error cargando pendientes')
    } else {
      const data = await pendingRes.json()
      const noCat = data.withoutCategory || []
      const noCost = data.withoutCost || []
      setWithoutCategory(noCat)
      setWithoutCost(noCost)
      setPendingRecalcCount(data.pendingRecalcCount || 0)

      if (!preserveSection) {
        if (noCat.length > 0) setOpenSection('rubro')
        else if (noCost.length > 0) setOpenSection('costo')
        else setOpenSection(null)
      }
    }

    if (categoriesRes.data) setCategories(categoriesRes.data)

    if (duplicatesRes.ok) {
      const dupData = await duplicatesRes.json()
      setDuplicatePairs(dupData.pairs || [])
    } else {
      setDuplicatePairs([])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingCategoryCount = withoutCategory.filter((p) => editingCategory[p.id]).length

  const handleBulkSaveCategories = async () => {
    const assignments = withoutCategory
      .filter((p) => editingCategory[p.id])
      .map((p) => ({
        product_id: p.id,
        category_id: editingCategory[p.id],
      }))

    if (assignments.length === 0) {
      setError('Seleccioná al menos un rubro')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/pending/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Error al guardar')
    } else {
      setSuccess(
        `Se guardaron ${data.data?.processed} productos correctamente. Errores: ${data.data?.errors || 0}`
      )
      setEditingCategory({})
      await loadData()
    }
  }

  const resolveCost = async (productId: string) => {
    const costPrice = parseFloat(editingCost[productId] || '')
    if (isNaN(costPrice) || costPrice < 0) {
      setError('Ingresá un costo válido')
      return
    }

    setError(null)
    setSuccess(null)
    setSavingCostId(productId)

    const res = await fetch('/api/pending/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, costPrice }),
    })

    const data = await res.json()
    setSavingCostId(null)

    if (!res.ok) {
      setError(data.error || 'Error al cargar costo')
    } else {
      setSuccess(
        `Costo cargado. Precio ${data.data?.status === 'set' ? 'calculado' : 'pendiente (sin margen)'}`
       )
       setEditingCost((prev) => {
         const next = { ...prev }
         delete next[productId]
         return next
       })
       await loadData()
     }
   }
   
   const getSimilarityColor = (sim: number) => {
     if (sim >= 0.9) return 'bg-red-500/20 border-red-400/40 text-red-100'
     if (sim >= 0.7) return 'bg-orange-400/20 border-orange-300/30 text-orange-100'
     return 'bg-amber-400/20 border-amber-300/30 text-amber-100'
   }
   
   const getSimilarityLabel = (sim: number) => {
     if (sim >= 0.9) return 'Duplicado casi seguro'
     if (sim >= 0.7) return 'Muy similares'
     return 'Similares'
   }
   
   const handleDismissDuplicate = async (aId: string, bId: string) => {
     setProcessing(`${aId}-${bId}`)
     setError(null)
     setSuccess(null)
     
     const res = await fetch('/api/products/dismiss-duplicate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ a_id: aId, b_id: bId }),
     })
     
     setProcessing(null)
     
     if (!res.ok) {
       const data = await res.json()
       setError(data.error || 'Error al marcar')
     } else {
       setDuplicatePairs(prev => prev.filter(p =>
         !(p.product_a_id === aId && p.product_b_id === bId)
       ))
       setSuccess('Par marcado como distinto')
     }
   }
   
    const handleMergeConfirm = async (
    keep: 'A' | 'B',
    stockMode: 'sum' | 'keep_target' | 'keep_source'
  ) => {
    if (!confirmMerge) return
    setProcessing('merge')
    setError(null)
    setSuccess(null)

    const sourceId = keep === 'A' ? confirmMerge.productBId : confirmMerge.productAId
    const targetId = keep === 'A' ? confirmMerge.productAId : confirmMerge.productBId

    const res = await fetch('/api/products/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: sourceId,
        target_id: targetId,
        stock_mode: stockMode,
      }),
    })

    setProcessing(null)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Error al fusionar')
    } else {
       const targetName = keep === 'A' ? confirmMerge.productAName : confirmMerge.productBName
       const sourceName = keep === 'A' ? confirmMerge.productBName : confirmMerge.productAName
       setSuccess(`"${sourceName}" fusionado en "${targetName}"`)
       await loadData(true)
       setConfirmMerge(null)
    }
  }
   
   const reloadDuplicates = async (threshold: number) => {
     setDuplicateThreshold(threshold)
     const res = await fetch(`/api/products/duplicates?min_similarity=${threshold}`)
     if (res.ok) {
       const data = await res.json()
       setDuplicatePairs(data.pairs || [])
     }
   }
   
   const handleRecalc = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/pending/recalculate', { method: 'POST' })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Error al recalcular')
    } else {
      setSuccess(
        `Precios recalculados. Actualizados: ${data.data?.updated}, errores: ${data.data?.errors}`
      )
      await loadData()
    }
  }

  const toggleSection = (section: 'rubro' | 'costo' | 'duplicados') => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  const totalPending = withoutCategory.length + withoutCost.length + pendingRecalcCount

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
                Pendientes
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">
                {totalPending === 0 ? 'Todo al día' : `${totalPending} ítem${totalPending === 1 ? '' : 's'} por resolver`}
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
              href="/cash"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Caja
            </Link>
          </div>
        </header>

        {/* Alertas */}
        {(error || success) && (
          <div className="mb-4 space-y-2">
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

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
            <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Sin rubro</div>
            <div className="text-amber-200 text-2xl font-extrabold">{withoutCategory.length}</div>
          </div>
          <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
            <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Sin costo</div>
            <div className="text-orange-200 text-2xl font-extrabold">{withoutCost.length}</div>
          </div>
          <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
            <div className="text-white/65 text-[11px] font-semibold uppercase tracking-wider">Recálculo</div>
            <div className="text-teal-200 text-2xl font-extrabold">{pendingRecalcCount}</div>
          </div>
        </div>

        {/* Banner recálculo masivo */}
        {pendingRecalcCount > 0 && (
          <div className="mb-5 bg-white/12 backdrop-blur-2xl border border-white/25 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-bold text-sm sm:text-base">
                Hay {pendingRecalcCount} producto(s) listos para calcular precio
              </p>
              <p className="text-white/65 text-xs sm:text-sm mt-0.5">
                Ya tienen rubro y costo, pero falta aplicar el margen.
              </p>
            </div>
            <button
              onClick={handleRecalc}
              disabled={saving}
              className="shrink-0 px-5 py-3 rounded-2xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white font-extrabold text-sm shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {saving ? 'Recalculando...' : `Recalcular (${pendingRecalcCount})`}
            </button>
          </div>
        )}

         {/* Tabs de colas */}
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <button
            onClick={() => toggleSection('rubro')}
            disabled={withoutCategory.length === 0}
            className={`text-left rounded-3xl p-4 border shadow-lg transition-all ${
              withoutCategory.length === 0
                ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                : openSection === 'rubro'
                ? 'bg-white text-[#2F5E58] border-white scale-[1.01]'
                : 'bg-white/12 backdrop-blur-xl border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-sm font-extrabold ${openSection === 'rubro' && withoutCategory.length > 0 ? 'text-[#2F5E58]' : 'text-inherit'}`}>
                  Asignar Rubro
                </div>
                <div className={`text-xs mt-0.5 ${openSection === 'rubro' && withoutCategory.length > 0 ? 'text-[#2F5E58]/70' : 'text-white/60'}`}>
                  {withoutCategory.length === 0 ? 'Sin artículos' : `${withoutCategory.length} producto${withoutCategory.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <span
                className={`min-w-[36px] h-9 px-2 rounded-full flex items-center justify-center text-sm font-extrabold border ${
                  openSection === 'rubro' && withoutCategory.length > 0
                    ? 'bg-[#2F5E58]/10 border-[#2F5E58]/20 text-[#2F5E58]'
                    : 'bg-amber-400/20 border-amber-300/30 text-amber-100'
                }`}
              >
                {withoutCategory.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => toggleSection('costo')}
            disabled={withoutCost.length === 0}
            className={`text-left rounded-3xl p-4 border shadow-lg transition-all ${
              withoutCost.length === 0
                ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                : openSection === 'costo'
                ? 'bg-white text-[#2F5E58] border-white scale-[1.01]'
                : 'bg-white/12 backdrop-blur-xl border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-sm font-extrabold ${openSection === 'costo' && withoutCost.length > 0 ? 'text-[#2F5E58]' : 'text-inherit'}`}>
                  Agregar Costo
                </div>
                <div className={`text-xs mt-0.5 ${openSection === 'costo' && withoutCost.length > 0 ? 'text-[#2F5E58]/70' : 'text-white/60'}`}>
                  {withoutCost.length === 0 ? 'Sin artículos' : `${withoutCost.length} producto${withoutCost.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <span
                className={`min-w-[36px] h-9 px-2 rounded-full flex items-center justify-center text-sm font-extrabold border ${
                  openSection === 'costo' && withoutCost.length > 0
                    ? 'bg-[#2F5E58]/10 border-[#2F5E58]/20 text-[#2F5E58]'
                    : 'bg-orange-400/20 border-orange-300/30 text-orange-100'
                }`}
              >
                {withoutCost.length}
              </span>
            </div>
          </button>

            <button
              onClick={() => toggleSection('duplicados')}
              disabled={duplicatePairs.length === 0}
              className={`text-left rounded-3xl p-4 border shadow-lg transition-all ${
                duplicatePairs.length === 0
                  ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                  : openSection === 'duplicados'
                  ? 'bg-white text-[#2E5E7E] border-white scale-[1.01]'
                  : 'bg-white/12 backdrop-blur-xl border-white/20 text-white hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-extrabold ${openSection === 'duplicados' && duplicatePairs.length > 0 ? 'text-[#2E5E7E]' : 'text-inherit'}`}>
                    Posibles Duplicados
                  </div>
                  <div className={`text-xs mt-0.5 ${openSection === 'duplicados' && duplicatePairs.length > 0 ? 'text-[#2E5E7E]/70' : 'text-white/60'}`}>
                    {duplicatePairs.length === 0 ? 'Sin duplicados' : `${duplicatePairs.length} par${duplicatePairs.length === 1 ? '' : 'es'}`}
                  </div>
                </div>
                <span
                  className={`min-w-[36px] h-9 px-2 rounded-full flex items-center justify-center text-sm font-extrabold border ${
                    openSection === 'duplicados' && duplicatePairs.length > 0
                      ? 'bg-[#2E5E7E]/10 border-[#2E5E7E]/20 text-[#2E5E7E]'
                      : 'bg-red-400/20 border-red-300/30 text-red-100'
                  }`}
                >
                  {duplicatePairs.length}
                </span>
              </div>
            </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[420px]">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/80 text-sm font-medium">Cargando pendientes...</span>
              </div>
            </div>
          ) : openSection === null || (withoutCategory.length === 0 && withoutCost.length === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
              <div className="w-16 h-16 rounded-3xl bg-emerald-400/20 border border-emerald-300/30 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-white font-extrabold text-lg">No hay pendientes</p>
              <p className="text-white/60 text-sm mt-1">Todo el catálogo operativo está completo.</p>
            </div>
          ) : openSection === 'rubro' && withoutCategory.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="px-4 sm:px-5 py-4 border-b border-white/15 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-extrabold text-base sm:text-lg">Asignar Rubro</h2>
                  <p className="text-white/60 text-xs mt-0.5">Seleccioná el rubro y guardá en lote</p>
                </div>
                <span className="text-white/70 text-xs font-semibold">
                  {pendingCategoryCount}/{withoutCategory.length} listos
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {withoutCategory.map((p) => {
                  const selected = !!editingCategory[p.id]
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                        selected
                          ? 'bg-white/20 border-white/35 shadow-lg'
                          : 'bg-white/10 border-white/15'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm sm:text-base truncate">{p.name}</p>
                          <p className="text-white/55 text-xs mt-0.5 truncate">
                            {p.sku || p.barcode || 'Sin código'}
                          </p>
                        </div>

                        <select
                          value={editingCategory[p.id] || ''}
                          onChange={(e) =>
                            setEditingCategory((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-full sm:w-56 bg-white/15 backdrop-blur-xl text-white border border-white/25 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white/25 focus:border-white/40"
                        >
                          <option value="" className="text-gray-900">
                            Seleccionar rubro
                          </option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id} className="text-gray-900">
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="p-4 sm:p-5 border-t border-white/15 bg-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleBulkSaveCategories}
                  disabled={saving || pendingCategoryCount === 0}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold text-sm shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Guardando...' : `Guardar todos (${pendingCategoryCount})`}
                </button>
                {pendingCategoryCount === 0 && (
                  <span className="text-sm text-white/60">Seleccioná rubro en al menos un producto</span>
                )}
              </div>
            </div>
          ) : openSection === 'costo' && withoutCost.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="px-4 sm:px-5 py-4 border-b border-white/15">
                <h2 className="text-white font-extrabold text-base sm:text-lg">Agregar Costo</h2>
                <p className="text-white/60 text-xs mt-0.5">
                  Al cargar el costo se calcula el precio de venta con el margen del rubro
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {withoutCost.map((p) => {
                  const hasValue = !!(editingCost[p.id] || '').trim()
                  const isSavingThis = savingCostId === p.id
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                        hasValue
                          ? 'bg-white/20 border-white/35 shadow-lg'
                          : 'bg-white/10 border-white/15'
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm sm:text-base truncate">{p.name}</p>
                          <p className="text-white/55 text-xs mt-0.5 truncate">
                            {p.sku || p.barcode || 'Sin código'} · Rubro:{' '}
                            {p.category?.name || 'sin rubro'}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <div className="relative flex-1 sm:max-w-[220px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm font-bold">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={editingCost[p.id] || ''}
                              onChange={(e) =>
                                setEditingCost((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') resolveCost(p.id)
                              }}
                              className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/15 backdrop-blur-xl text-white border border-white/25 text-sm outline-none focus:bg-white/25 focus:border-white/40 placeholder:text-white/40"
                            />
                          </div>

                          <button
                            onClick={() => resolveCost(p.id)}
                            disabled={isSavingThis || !hasValue}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#F2A65A] to-[#E0783C] text-white text-sm font-extrabold shadow-md border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {isSavingThis ? 'Guardando...' : 'Cargar costo'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
           ) : openSection === 'duplicados' ? (
            <div className="flex flex-col h-full">
              <div className="px-4 sm:px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-white font-extrabold text-base sm:text-lg">Posibles Duplicados</h2>
                  <p className="text-white/60 text-xs mt-0.5">Revisá pares con nombres similares y unificalos</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-white/60 text-xs">Umbral:</label>
                  <select
                    value={duplicateThreshold}
                    onChange={(e) => reloadDuplicates(parseFloat(e.target.value))}
                    className="bg-black/20 border border-white/15 text-white rounded-xl px-2 py-1 text-xs"
                  >
                    <option value={0.9}>90% (estricto)</option>
                    <option value={0.7}>70% (recomendado)</option>
                    <option value={0.55}>55% (amplio)</option>
                    <option value={0.4}>40% (muy amplio)</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {duplicatePairs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
                    <p className="text-white font-extrabold text-lg">No hay duplicados con ese umbral</p>
                    <p className="text-white/60 text-sm mt-1">Probá con un umbral más amplio.</p>
                  </div>
                ) : (
                  duplicatePairs.map((pair) => (
                    <div
                      key={`${pair.product_a_id}-${pair.product_b_id}`}
                      className="rounded-2xl p-4 border bg-white/10 border-white/15 shadow-lg"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getSimilarityColor(pair.similarity)}`}>
                          {getSimilarityLabel(pair.similarity)} · {(pair.similarity * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                          <p className="text-white font-semibold text-sm break-words">{pair.product_a_name}</p>
                          <p className="text-white/50 text-xs mt-1">
                            {pair.product_a_sku || pair.product_a_barcode || 'Sin código'}
                            {pair.product_a_category && ` · ${pair.product_a_category}`}
                          </p>
                          <p className="text-white/70 text-xs mt-1">Stock: {pair.product_a_stock}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                          <p className="text-white font-semibold text-sm break-words">{pair.product_b_name}</p>
                          <p className="text-white/50 text-xs mt-1">
                            {pair.product_b_sku || pair.product_b_barcode || 'Sin código'}
                            {pair.product_b_category && ` · ${pair.product_b_category}`}
                          </p>
                          <p className="text-white/70 text-xs mt-1">Stock: {pair.product_b_stock}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setConfirmMerge({
                            productAId: pair.product_a_id,
                            productAName: pair.product_a_name,
                            productAStock: pair.product_a_stock,
                            productBId: pair.product_b_id,
                            productBName: pair.product_b_name,
                            productBStock: pair.product_b_stock,
                          })}
                          disabled={processing !== null}
                          className="px-3 py-2 rounded-xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white font-bold text-xs hover:brightness-110 disabled:opacity-50"
                        >
                          Revisar y fusionar
                        </button>
                        <button
                          onClick={() => handleDismissDuplicate(pair.product_a_id, pair.product_b_id)}
                          disabled={processing !== null}
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs hover:bg-white/20 disabled:opacity-50"
                        >
                          No son duplicados
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

        {confirmMerge && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-white text-lg font-extrabold mb-1">Confirmar fusión</h3>
              <p className="text-white/60 text-xs mb-4">
                Elegí qué producto conservar y cómo tratar el stock.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 border border-white/15 rounded-xl p-3">
                  <p className="text-white/50 text-[10px] font-bold uppercase mb-1">Producto A</p>
                  <p className="text-white font-bold text-sm break-words">{confirmMerge.productAName}</p>
                  <p className="text-white/70 text-xs mt-1">Stock: {confirmMerge.productAStock}</p>
                </div>
                <div className="bg-white/5 border border-white/15 rounded-xl p-3">
                  <p className="text-white/50 text-[10px] font-bold uppercase mb-1">Producto B</p>
                  <p className="text-white font-bold text-sm break-words">{confirmMerge.productBName}</p>
                  <p className="text-white/70 text-xs mt-1">Stock: {confirmMerge.productBStock}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <button
                  onClick={() => handleMergeConfirm('A', 'sum')}
                  disabled={processing === 'merge'}
                  className="w-full text-left px-4 py-3 rounded-xl bg-gradient-to-br from-[#7FD1C6] to-[#3E9D91] text-white hover:brightness-110 disabled:opacity-50"
                >
                  <p className="font-extrabold text-sm">Sumar stocks (conservar A)</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    Stock final: {confirmMerge.productAStock + confirmMerge.productBStock} · Conserva "{confirmMerge.productAName}"
                  </p>
                </button>

                <button
                  onClick={() => handleMergeConfirm('A', 'keep_target')}
                  disabled={processing === 'merge'}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <p className="font-extrabold text-sm">Conservar stock de A</p>
                  <p className="text-white/70 text-xs mt-0.5">
                    Stock final: {confirmMerge.productAStock} · Conserva "{confirmMerge.productAName}"
                  </p>
                </button>

                <button
                  onClick={() => handleMergeConfirm('B', 'keep_target')}
                  disabled={processing === 'merge'}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <p className="font-extrabold text-sm">Conservar stock de B</p>
                  <p className="text-white/70 text-xs mt-0.5">
                    Stock final: {confirmMerge.productBStock} · Conserva "{confirmMerge.productBName}"
                  </p>
                </button>
              </div>

              <p className="text-white/60 text-[11px] mb-4">
                El producto no conservado quedará inactivo. Los movimientos de stock se reasignan al producto conservado. Se puede revertir con "Restaurar producto".
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmMerge(null)}
                  disabled={processing === 'merge'}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }