'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

type MarginItem = {
  category_id: string
  category_name: string
  margin_pct: number
}

export default function SettingsPage() {
  const [items, setItems] = useState<MarginItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/settings/margins')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al cargar márgenes')
      } else {
        setItems(data.categories || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/settings/margins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ margins: items }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Error al guardar')
    } else {
      setSuccess('Márgenes actualizados correctamente.')
    }
  }

  const handleApplyMargins = async () => {
    setApplying(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/settings/apply-margins', {
      method: 'POST',
    })

    const data = await res.json()
    setApplying(false)

    if (!res.ok) {
      setError(data.error || 'Error al aplicar márgenes')
    } else {
      setSuccess(`Márgenes aplicados. Productos actualizados: ${data.updatedCount}`)
      if (data.errors && data.errors.length > 0) {
        console.warn('Errores aplicando márgenes:', data.errors)
      }
    }
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Configuración de márgenes por rubro</h1>

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.category_id} className="flex items-center gap-4">
                    <span className="text-white w-40">{item.category_name}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.margin_pct}
                      onChange={(e) => {
                        const updated = [...items]
                        updated[idx] = { ...updated[idx], margin_pct: parseFloat(e.target.value) || 0 }
                        setItems(updated)
                      }}
                      className="w-32 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                    />
                    <span className="text-gray-300">%</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar márgenes'}
              </button>

              {error && <div className="mt-4 text-red-400">{error}</div>}
              {success && <div className="mt-4 text-green-400">{success}</div>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}