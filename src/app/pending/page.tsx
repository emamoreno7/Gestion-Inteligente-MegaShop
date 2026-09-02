'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

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

export default function PendingPage() {
  const [withoutCategory, setWithoutCategory] = useState<PendingProduct[]>([])
  const [withoutCost, setWithoutCost] = useState<PendingProduct[]>([])
  const [pendingRecalcCount, setPendingRecalcCount] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<'rubro' | 'costo' | null>(null)
  const [editingCategory, setEditingCategory] = useState<Record<string, string>>({})
  const [editingCost, setEditingCost] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const loadData = async () => {
    setLoading(true)
    const [pendingRes, categoriesRes] = await Promise.all([
      fetch('/api/pending'),
      supabase.from('categories').select('id, name'),
    ])

    if (!pendingRes.ok) {
      const data = await pendingRes.json()
      setError(data.error || 'Error cargando pendientes')
    } else {
      const data = await pendingRes.json()
      setWithoutCategory(data.withoutCategory || [])
      setWithoutCost(data.withoutCost || [])
      setPendingRecalcCount(data.pendingRecalcCount || 0)
    }

    if (categoriesRes.data) setCategories(categoriesRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const pendingCategoryCount = withoutCategory.filter(p => editingCategory[p.id]).length

  const handleBulkSaveCategories = async () => {
    const assignments = withoutCategory
      .filter(p => editingCategory[p.id])
      .map(p => ({
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
      setSuccess(`Se guardaron ${data.data?.processed} productos correctamente. Errores: ${data.data?.errors || 0}`)
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

    const res = await fetch('/api/pending/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, costPrice }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al cargar costo')
    } else {
      setSuccess(`Costo cargado. Precio ${data.data?.status === 'set' ? 'calculado' : 'pendiente (sin margen)'}`)
      setEditingCost(prev => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
      await loadData()
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
      setSuccess(`Precios recalculados. Actualizados: ${data.data?.updated}, errores: ${data.data?.errors}`)
      await loadData()
    }
  }

  const toggleSection = (section: 'rubro' | 'costo') => {
    setOpenSection(prev => (prev === section ? null : section))
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Pendientes de revisión</h1>

          {error && <div className="text-red-400 mb-4">{error}</div>}
          {success && <div className="text-green-400 mb-4">{success}</div>}

          {/* Botón de recálculo masivo */}
          {pendingRecalcCount > 0 && (
            <div className="mb-6 p-4 bg-gray-800 rounded">
              <p className="text-sm text-gray-300 mb-2">
                Hay {pendingRecalcCount} producto(s) con rubro y costo que no tienen precio calculado.
              </p>
              <button
                onClick={handleRecalc}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Recalculando...' : `Recalcular precios pendientes (${pendingRecalcCount})`}
              </button>
            </div>
          )}

          <div className="mb-6 space-y-2">
            <button
              onClick={() => toggleSection('rubro')}
              className={`w-full text-left px-4 py-3 rounded ${withoutCategory.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
              disabled={withoutCategory.length === 0}
            >
              Asignar Rubro {withoutCategory.length === 0 ? '(sin artículos)' : `(${withoutCategory.length})`}
            </button>

            <button
              onClick={() => toggleSection('costo')}
              className={`w-full text-left px-4 py-3 rounded ${withoutCost.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
              disabled={withoutCost.length === 0}
            >
              Agregar Costo {withoutCost.length === 0 ? '(sin artículos)' : `(${withoutCost.length})`}
            </button>
          </div>

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : (
            <>
              {openSection === 'rubro' && withoutCategory.length > 0 && (
                <div>
                  <div className="space-y-3">
                    {withoutCategory.map(p => (
                      <div key={p.id} className="flex items-start gap-3 p-3 bg-gray-800 rounded">
                        <div className="flex-1">
                          <p className="text-white font-medium">{p.name}</p>
                          <p className="text-sm text-gray-400">
                            {p.sku || p.barcode || 'Sin código'}
                          </p>
                        </div>
                        <select
                          value={editingCategory[p.id] || ''}
                          onChange={(e) => setEditingCategory(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                        >
                          <option value="">Seleccionar rubro</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <button
                      onClick={handleBulkSaveCategories}
                      disabled={saving || pendingCategoryCount === 0}
                      className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : `Guardar todos (${pendingCategoryCount})`}
                    </button>
                    {pendingCategoryCount === 0 && (
                      <span className="text-sm text-gray-400">Seleccioná rubro en al menos un producto</span>
                    )}
                  </div>
                </div>
              )}

              {openSection === 'costo' && withoutCost.length > 0 && (
                <div className="space-y-4">
                  {withoutCost.map(p => (
                    <div key={p.id} className="bg-gray-800 rounded p-4">
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-sm text-gray-400">
                        {p.sku || p.barcode || 'Sin código'} · Rubro: {p.category?.name || 'sin rubro'}
                      </p>
                      <div className="mt-3 flex gap-2 items-end">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Costo"
                          value={editingCost[p.id] || ''}
                          onChange={(e) => setEditingCost(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                        />
                        <button
                          onClick={() => resolveCost(p.id)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          Cargar costo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}