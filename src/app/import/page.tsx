'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { classifyByKeywords } from '@/lib/classify'

type ProductRow = {
  name: string
  sku?: string | null
  barcode?: string | null
  cost_price?: number | null
  sale_price?: number | null
  category?: string | null
  quantity?: number
}

type Category = {
  id: string
  name: string
}

export default function ImportPage() {
  const [tab, setTab] = useState<'file' | 'ocr'>('file')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [fileName, setFileName] = useState('')
  const [importType, setImportType] = useState<'csv' | 'excel' | 'ocr'>('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acceptedCheck, setAcceptedCheck] = useState(false)
  const [omitMap, setOmitMap] = useState<Record<number, boolean>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase.from('categories').select('id, name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  const normalizeNumber = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value
    let str = String(value).replace(/\./g, '').replace(',', '.')
    const num = parseFloat(str)
    return isNaN(num) ? null : num
  }

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '0,00'
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const classifyProducts = async (productsToClassify: ProductRow[]): Promise<ProductRow[]> => {
    let partialClassified: ProductRow[] = productsToClassify.map(p => ({
      ...p,
      category: p.category && p.category !== 'otros' ? p.category : (classifyByKeywords(p.name) || p.category || 'otros'),
    }))

    const pendingIndices: number[] = []
    const pendingProducts: ProductRow[] = []

    partialClassified.forEach((p, idx) => {
      if (!p.category || p.category === 'otros') {
        pendingIndices.push(idx)
        pendingProducts.push(p)
      }
    })

    if (pendingProducts.length > 0) {
      try {
        const res = await fetch('/api/import/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: pendingProducts }),
        })
        const data = await res.json()
        if (res.ok && data.classified) {
          const classifiedMap = new Map<number, string>()
          data.classified.forEach((item: { index: number; category: string }) => {
            classifiedMap.set(pendingIndices[item.index - 1], item.category)
          })
          partialClassified = partialClassified.map((p, idx) => ({
            ...p,
            category: classifiedMap.get(idx) || p.category || 'otros',
          }))
        }
      } catch (e) {
        console.error('Error clasificando con IA:', e)
      }
    }

    return partialClassified
  }

  const handleFileUpload = async (file: File) => {
    setError(null)
    setSuccess(null)
    setFileName(file.name)
    setLoading(true)

    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<ProductRow>(sheet)
        const normalized = data.map(p => ({
          ...p,
          cost_price: normalizeNumber(p.cost_price),
          sale_price: normalizeNumber(p.sale_price),
          quantity: p.quantity ? parseInt(String(p.quantity)) : 1,
        }))
        const classified = await classifyProducts(normalized)
        setProducts(classified)
        setImportType(file.name.endsWith('.csv') ? 'csv' : 'excel')
      } else {
        setError('Formato no soportado. Usa CSV o Excel.')
      }
    } catch (e) {
      setError('Error al leer el archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleOCRUpload = async (file: File) => {
    setError(null)
    setSuccess(null)
    setFileName(file.name)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error en OCR')
      } else if (data.products && Array.isArray(data.products)) {
        let productsFromOCR = data.products.map((p: any) => ({
          name: p.name || 'Producto',
          sku: p.sku || null,
          barcode: p.barcode || null,
          quantity: p.quantity ? parseInt(String(p.quantity)) : 1,
          cost_price: normalizeNumber(p.cost_price),
          sale_price: normalizeNumber(p.sale_price),
          category: p.category || 'otros',
        }))

        const hasRealCategory = productsFromOCR.some((p: ProductRow) => p.category && p.category !== 'otros')
        if (!hasRealCategory) {
          productsFromOCR = await classifyProducts(productsFromOCR)
        }

        setProducts(productsFromOCR)
        setImportType('ocr')
      } else {
        setError('No se pudieron extraer productos. Revisa la imagen o intenta con otra.')
      }
    } catch (e) {
      setError('Error al procesar OCR')
    } finally {
      setLoading(false)
    }
  }

  const totalUnits = () => products.reduce((acc, p) => acc + (p.quantity || 1), 0)
  const totalCost = () => products.reduce((acc, p) => acc + ((p.cost_price || 0) * (p.quantity || 1)), 0)

  const getCategorySummary = () => {
    const summary: Record<string, number> = {}
    products.forEach((p, idx) => {
      if (!omitMap[idx]) {
        const cat = p.category || 'otros'
        summary[cat] = (summary[cat] || 0) + (p.quantity || 1)
      }
    })
    return Object.entries(summary).map(([category, count]) => ({ category, count }))
  }

  const confirmSave = async () => {
    if (!acceptedCheck) {
      setError('Debes aceptar que has revisado los detalles.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const productsToSave = products.filter((_, idx) => !omitMap[idx])
      if (productsToSave.length === 0) {
        throw new Error('No hay productos seleccionados para guardar.')
      }

      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: productsToSave,
          importType,
          fileName,
        }),
      })

      const responseData = await res.json()
      if (!res.ok) {
        throw new Error(responseData.error || 'Error al guardar')
      }

      const status = responseData.data?.status
      if (status === 'pending_approval') {
        setSuccess('Carga enviada para aprobación del encargado/admin.')
      } else if (status === 'completed') {
        setSuccess(`Se importaron ${productsToSave.length} productos y se actualizó el stock.`)
      } else {
        setSuccess('Operación completada.')
      }

      setProducts([])
      setFileName('')
      setShowAuditModal(false)
      setAcceptedCheck(false)
      setOmitMap({})
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleOmit = (idx: number) => {
    setOmitMap(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Importar Productos</h1>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('file')}
            className={`px-4 py-2 rounded ${tab === 'file' ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            CSV / Excel
          </button>
          <button
            onClick={() => setTab('ocr')}
            className={`px-4 py-2 rounded ${tab === 'ocr' ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Foto (OCR)
          </button>
        </div>

        {tab === 'file' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="text-gray-300"
            />
            <p className="text-gray-400 text-sm mt-2">
              Columnas esperadas: name, sku, barcode, cost_price, sale_price, category (opcional), quantity
            </p>
          </div>
        )}

        {tab === 'ocr' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleOCRUpload(e.target.files[0])}
              className="text-gray-300"
            />
            <p className="text-gray-400 text-sm mt-2">
              Sube una foto de un remito o lista manuscrita. El sistema extraerá los productos.
            </p>
          </div>
        )}

        {loading && <p className="text-gray-300 mt-4">Procesando...</p>}

        {products.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-white mb-4">Vista previa ({products.length} productos)</h2>
            <div className="bg-gray-800 rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Producto</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Código</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Cant.</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Rubro</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Costo unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {products.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-white">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        {p.sku || p.barcode || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        <input
                          type="number"
                          min="1"
                          value={p.quantity || 1}
                          onChange={(e) => {
                            const updated = [...products]
                            updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 }
                            setProducts(updated)
                          }}
                          className="w-20 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        <select
                          value={p.category || 'otros'}
                          onChange={(e) => {
                            const updated = [...products]
                            updated[idx] = { ...updated[idx], category: e.target.value }
                            setProducts(updated)
                          }}
                          className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.name.toLowerCase()}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        <input
                          type="text"
                          value={p.cost_price !== undefined && p.cost_price !== null ? p.cost_price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            const num = normalizeNumber(raw)
                            const updated = [...products]
                            updated[idx] = { ...updated[idx], cost_price: num }
                            setProducts(updated)
                          }}
                          className="w-32 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-700">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-white">Totales</td>
                    <td></td>
                    <td className="px-4 py-2 text-sm font-semibold text-white">{totalUnits()}</td>
                    <td></td>
                    <td className="px-4 py-2 text-sm font-semibold text-white">${formatCurrency(totalCost())}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              onClick={() => setShowAuditModal(true)}
              disabled={loading}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Guardar productos
            </button>
          </div>
        )}

        {error && <div className="mt-4 text-red-400">{error}</div>}
        {success && <div className="mt-4 text-green-400">{success}</div>}
      </div>

      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Auditoría rápida de carga</h2>
            <p className="text-gray-300 mb-4">Revisa cada producto. Puedes omitir los que no estén correctos.</p>
            
            <div className="space-y-2 mb-4">
              {products.map((p, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-2 rounded ${omitMap[idx] ? 'bg-gray-700 opacity-50' : 'bg-gray-750'}`}>
                  <input
                    type="checkbox"
                    checked={!omitMap[idx]}
                    onChange={() => toggleOmit(idx)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-gray-400">Cantidad: {p.quantity || 1} | Rubro: {p.category || 'otros'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="flex items-start gap-2 text-gray-300 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedCheck}
                  onChange={(e) => setAcceptedCheck(e.target.checked)}
                  className="mt-1"
                />
                <span>Acepto que he revisado los detalles y estoy seguro de cargar esta mercadería al stock.</span>
              </label>
            </div>

            <div className="mb-4 text-gray-300">
              Resumen:
              {getCategorySummary().map(({ category, count }) => (
                <div key={category} className="flex justify-between">
                  <span>{category}</span>
                  <span className="font-semibold">{count} unidad(es)</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={confirmSave}
                disabled={saving || !acceptedCheck}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
              <button
                onClick={() => setShowAuditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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